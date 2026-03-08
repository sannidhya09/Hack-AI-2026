import os
import asyncio
import base64
import httpx
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import Optional, List
import logging

logging.basicConfig(level=logging.INFO)
load_dotenv()

app = FastAPI(title="CoDriver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ────────────────────────────────────────
GEMINI_KEY     = os.getenv("GEMINI_API_KEY")
ELEVENLABS_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID       = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

gemini_client = genai.Client(api_key=GEMINI_KEY)

# ─── In-memory trip state (resets on redeploy, fine for a demo) ──
conversation_history: List[str] = []   # full trip conversation

# ─── Location context cache — refreshed every 60s not every call ──
_loc_cache: dict = {"ts": 0, "location": "", "weather": "", "speed_limit": 0}
LOC_CACHE_TTL = 60  # seconds
trip_events: List[dict] = []           # driving events logged this trip
trip_active: bool = False
trip_start_time: Optional[str] = None

# ─── ElevenLabs TTS ────────────────────────────────
async def text_to_speech(text: str) -> Optional[str]:
    if not ELEVENLABS_KEY or not text:
        return None
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
                headers={
                    "xi-api-key": ELEVENLABS_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {"stability": 0.50, "similarity_boost": 0.82, "style": 0.20, "speed": 0.9},
                },
            )
            if r.status_code == 200:
                return base64.b64encode(r.content).decode()
    except Exception as e:
        logging.error(f"TTS error: {e}")
    return None

# ─── Speed limit via Overpass ──────────────────────
async def get_speed_limit(lat: float, lng: float) -> int:
    try:
        query = f"""
        [out:json][timeout:5];
        way(around:30,{lat},{lng})[maxspeed];
        out 1;
        """
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.post("https://overpass-api.de/api/interpreter", data={"data": query})
            data = r.json()
            elements = data.get("elements", [])
            if elements:
                raw = elements[0].get("tags", {}).get("maxspeed", "")
                digits = "".join(filter(str.isdigit, raw.split()[0] if raw else ""))
                if digits:
                    val = int(digits)
                    if "mph" in raw.lower() or val < 130:
                        return round(val * 1.60934) if "mph" in raw.lower() else val
    except Exception as e:
        logging.warning(f"Speed limit lookup failed: {e}")
    return 0

# ─── Reverse geocode: city + street via Nominatim ──
async def get_location_name(lat: float, lng: float) -> str:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json",
                headers={"User-Agent": "CoDriver/1.0"}
            )
            addr = r.json().get("address", {})
            road  = addr.get("road") or addr.get("street", "")
            city  = addr.get("city") or addr.get("town") or addr.get("suburb") or addr.get("county", "")
            state = addr.get("state", "")
            parts = [p for p in [road, city, state] if p]
            return ", ".join(parts) if parts else ""
    except:
        return ""

# ─── Weather via Open-Meteo (free, no key needed) ──
async def get_weather(lat: float, lng: float) -> str:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lng}"
                f"&current=temperature_2m,weather_code,wind_speed_10m,precipitation"
                f"&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto"
            )
            cur  = r.json().get("current", {})
            temp = cur.get("temperature_2m")
            wind = cur.get("wind_speed_10m")
            code = cur.get("weather_code", 0)
            rain = cur.get("precipitation", 0)
            if   code == 0:   desc = "clear skies"
            elif code <= 3:   desc = "partly cloudy"
            elif code <= 49:  desc = "foggy"
            elif code <= 67:  desc = f"{'heavy' if rain > 5 else 'light'} rain"
            elif code <= 77:  desc = "snowing"
            elif code >= 95:  desc = "stormy"
            else:             desc = "cloudy"
            return f"{desc}, {round(temp)}°F, wind {round(wind)} mph" if temp else ""
    except:
        return ""

# ─── Gemini AI Brain ───────────────────────────────
CODRIVER_PERSONA = """You are CoDriver — a real friend riding shotgun for this entire trip.

WHO YOU ARE:
You are that one friend everyone wishes they had in the passenger seat. Someone who actually pays attention, cracks the right joke, notices when you seem off, and genuinely cares about getting you home safe. You are not an assistant. You are not a GPS. You are company.

You have been in this car since the trip started. You have seen every hard brake, heard every word, and you know this trip. Reference it naturally the way a real passenger would.

HOW YOU TALK:
- You are spoken aloud through car speakers. Write exactly how you would say it out loud, not how you would type it.
- Speak naturally for up to 30 seconds — enough to say something real and meaningful. Aim for 3-6 sentences for normal responses, more if the driver asked something interesting or wants to chat.
- Contractions, casual language, real human rhythm and pace.
- Ask follow-up questions when the driver seems to want to talk.
- Light humor at the right moment, never forced.
- Real warmth when they seem tired or stressed, not clinical concern.
- Never sound like a robot, a GPS, or a corporate assistant.
- Never repeat the same opener. Never start with Certainly, Sure, Of course, As your AI, I notice, I detect.
- If they told you their name earlier in the trip, use it occasionally and naturally.
- You can have opinions. You can be curious. You can ask questions back.

WHAT YOU KNOW RIGHT NOW:
- Their exact speed and the speed limit on this specific road
- The actual street name and city they are driving through
- Current weather outside the car
- Time of day and how long they have been driving
- Every hard brake, sharp turn, hard acceleration this trip and when each happened
- Their emotional state right now from the camera
- The entire conversation since this trip started

HOW TO RESPOND:

driver_spoke: Listen. Answer directly and completely first. Then be human about it.
  Speed question: give the exact mph.
  Hard brakes: give the exact count.
  Location: tell them the street and city.
  Just want to talk: engage. Be genuinely curious back. Have a conversation.

speeding: Do not lecture. Say it like a friend would. Mention the exact numbers.

hard_brake: React like a real passenger. Ask if they are okay. Keep it natural.

sharp_turn_left or sharp_turn_right: Note it, especially if it is a pattern this trip.

hard_acceleration: A little impressed, a little cautious. Match their energy.

swerve: Immediate and genuine. Ask if everything is okay.

tired: Be a friend, not a doctor. Ask what is going on. Suggest a break gently.

stressed: Do not tell them to breathe. Ask what is happening. Be present with them.

happy: Match it fully. Be fun. Ask what has them in a good mood.

proactive: This is your chance to just exist in the car with them. Look at the real data.
  If they have been driving 20 plus minutes, check in genuinely.
  If there have been multiple hard brakes, bring it up casually.
  If it is late at night, acknowledge it.
  If weather is notable, mention it.
  If you are in an interesting area, say something about it.
  Never say trip is going smoothly. Find something real and specific to say."""

class AnalyzeRequest(BaseModel):
    trigger: str
    sensorData: dict
    emotion: str = "neutral"
    gps: dict = {}
    speedKmh: float = 0
    driverMessage: str = ""
    tripStats: dict = {}

async def get_ai_response(req: AnalyzeRequest, speed_limit_kmh: int, location_name: str = "", weather: str = "") -> str:
    global conversation_history, trip_events

    speed_limit_mph = round(speed_limit_kmh / 1.60934) if speed_limit_kmh else 35
    speed_mph = round(req.speedKmh / 1.60934)
    trip_secs = req.tripStats.get("tripSecs", 0)
    trip_mins = trip_secs // 60
    trip_secs_rem = trip_secs % 60

    hard_brakes = req.sensorData.get("hardBrakes", 0)
    sharp_turns = req.sensorData.get("sharpTurns", 0)
    hard_accels = req.sensorData.get("hardAccels", 0)
    g_force = req.sensorData.get("gForce", 0)
    current_event = req.sensorData.get("event", "normal")

    now = datetime.now()
    hour = now.hour
    if hour < 5:    time_of_day = "late night"
    elif hour < 12: time_of_day = "morning"
    elif hour < 17: time_of_day = "afternoon"
    elif hour < 20: time_of_day = "evening"
    else:           time_of_day = "night"

    # Log significant events to trip log
    if req.trigger in ("hard_brake", "sharp_turn_left", "sharp_turn_right", "hard_acceleration", "swerve", "speeding"):
        trip_events.append({
            "time": f"{trip_mins}m{trip_secs_rem:02d}s",
            "event": req.trigger,
            "speed_mph": speed_mph,
            "g_force": round(g_force, 2),
        })

    # Build trip event summary
    recent_events_str = ""
    if trip_events:
        last5 = trip_events[-5:]
        recent_events_str = "\nDriving events this trip: " + ", ".join(
            f"{e['event']} at {e['time']} ({e['speed_mph']}mph)" for e in last5
        )

    speeding_str = f"OVER LIMIT by {speed_mph - speed_limit_mph} mph" if speed_mph > speed_limit_mph else "within limit"

    emotion_context = {
        "neutral":  "alert and focused",
        "happy":    "smiling, in a good mood",
        "sad":      "looks sad or upset — something may be bothering them",
        "sleeping": "eyes nearly closed or closed — drowsy, dangerous",
    }.get(req.emotion, req.emotion)

    situation = f"""RIGHT NOW IN THE CAR:
Time: {time_of_day} ({now.strftime("%I:%M %p")})
Location: {location_name if location_name else f"{req.gps.get('lat', '?')} {req.gps.get('lng', '?')}"}
Weather outside: {weather if weather else "unknown"}

DRIVING DATA:
Speed: {speed_mph} mph | Limit: {speed_limit_mph} mph | {speeding_str}
G-force: {g_force:.2f}g | Sensor event right now: {current_event}
Trip time: {trip_mins} min {trip_secs_rem} sec
Hard brakes: {hard_brakes} | Sharp turns: {sharp_turns} | Hard accelerations: {hard_accels}
{recent_events_str}

DRIVER STATE:
Camera shows driver is: {emotion_context}

WHAT TRIGGERED THIS RESPONSE: {req.trigger}
DRIVER JUST SAID: "{req.driverMessage}"

FULL CONVERSATION THIS TRIP (remember all of it):
{chr(10).join(conversation_history[-30:]) if conversation_history else "(just started)"}

Respond as CoDriver:"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{CODRIVER_PERSONA}\n\n{situation}",
            config=types.GenerateContentConfig(
                temperature=0.85,
                top_p=0.95,
                max_output_tokens=1000,
                # Thinking enabled — gives smarter, more natural conversational responses
            )
        )
        reply = response.text.strip()


        # Save to conversation history
        if req.driverMessage:
            conversation_history.append(f"Driver: {req.driverMessage}")
        conversation_history.append(f"CoDriver: {reply}")
        # Keep up to 60 turns (30 exchanges) — enough for 1hr trip
        if len(conversation_history) > 60:
            conversation_history = conversation_history[-60:]

        return reply
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        # Useful fallbacks that use real data
        speed_mph_val = round(req.speedKmh / 1.60934)
        if req.trigger == "driver_spoke" and req.driverMessage:
            msg = req.driverMessage.lower()
            if "speed" in msg:
                return f"You're doing {speed_mph_val} mph right now."
            if "brake" in msg:
                return f"You've had {req.sensorData.get('hardBrakes', 0)} hard brakes this trip."
            if "turn" in msg:
                return f"You've had {req.sensorData.get('sharpTurns', 0)} sharp turns this trip."
        if req.trigger == "speeding":
            return f"Hey, you're at {speed_mph_val} in a {speed_limit_mph} zone — ease off a bit."
        if req.trigger == "hard_brake":
            return "That was a hard stop — you alright up there?"
        if req.trigger == "tired":
            return "You're looking a bit tired — maybe time for a quick break?"
        return "I'm here with you — what's up?"

# ─── API Endpoints ─────────────────────────────────

class AnalyzeRequest(BaseModel):
    trigger: str
    sensorData: dict
    emotion: str = "neutral"
    gps: dict = {}
    speedKmh: float = 0
    driverMessage: str = ""
    tripStats: dict = {}

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    global trip_active, trip_start_time
    if not trip_active:
        trip_active = True
        trip_start_time = datetime.now().isoformat()

    lat = req.gps.get("lat")
    lng = req.gps.get("lng")

    # Location cache — only re-fetch every 60s to cut AI response latency
    speed_limit, location_name, weather = 0, "", ""
    if lat and lng:
        import time as _t
        now_ts = _t.monotonic()
        if now_ts - _loc_cache["ts"] > LOC_CACHE_TTL:
            speed_limit, location_name, weather = await asyncio.gather(
                get_speed_limit(lat, lng),
                get_location_name(lat, lng),
                get_weather(lat, lng),
            )
            _loc_cache.update({"ts": now_ts, "location": location_name,
                                "weather": weather, "speed_limit": speed_limit})
            logging.info(f"Location cache refreshed: {location_name}")
        else:
            speed_limit   = _loc_cache["speed_limit"]
            location_name = _loc_cache["location"]
            weather       = _loc_cache["weather"]

    reply = await get_ai_response(req, speed_limit, location_name, weather)
    audio = await text_to_speech(reply)
    return {"reply": reply, "audio": audio, "speedLimit": round(speed_limit / 1.60934) if speed_limit else 0}

@app.post("/api/trip-start")
async def trip_start():
    global conversation_history, trip_events, trip_active, trip_start_time
    conversation_history = []
    trip_events = []
    trip_active = True
    trip_start_time = datetime.now().isoformat()
    logging.info("Trip started")
    return {"status": "started", "time": trip_start_time}

@app.post("/api/trip-end")
async def trip_end(data: dict):
    global trip_active, conversation_history, trip_events
    trip_active = False

    duration_secs = data.get("tripStats", {}).get("tripSecs", 0)
    mins = duration_secs // 60
    max_speed_mph = round(data.get("maxSpeed", 0) / 1.60934)
    hard_brakes = data.get("hardBrakes", 0)
    sharp_turns = data.get("sharpTurns", 0)
    hard_accels = data.get("hardAccels", 0)

    # Build event summary
    event_summary = ""
    if trip_events:
        event_summary = f"\nKey events during the trip: " + "; ".join(
            f"{e['event']} at {e['time']}" for e in trip_events[-10:]
        )

    prompt = f"""{CODRIVER_PERSONA}

The trip just ended. Give a warm, specific, conversational summary of this exact trip. You can speak for up to 30 seconds — be thorough.
Trip duration: {mins} minutes
Max speed reached: {max_speed_mph} mph
Hard brakes: {hard_brakes}
Sharp turns: {sharp_turns}
Hard accelerations: {hard_accels}
{event_summary}

Conversation highlights this trip:
{chr(10).join(conversation_history[-10:]) if conversation_history else "(no conversation)"}

Be specific to these numbers. If it was clean driving, say so warmly. If there were issues, mention them kindly.
End with something like "see you next time" or "safe travels"."""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=1000)
        )
        summary_text = response.text.strip()
    except:
        summary_text = f"That was a {mins}-minute trip, max speed {max_speed_mph} mph."
        if hard_brakes == 0 and sharp_turns == 0:
            summary_text += " Really smooth driving — no hard events at all!"
        else:
            summary_text += f" You had {hard_brakes} hard brakes and {sharp_turns} sharp turns. Keep that in mind next time."
        summary_text += " Safe travels!"

    audio = await text_to_speech(summary_text)

    # Reset for next trip
    conversation_history = []
    trip_events = []

    return {"summary": summary_text, "audio": audio}

@app.post("/api/crash")
async def crash_detection(data: dict):
    g_force = data.get("sensorData", {}).get("gForce", 0)
    gps     = data.get("gps", {})
    msg     = f"Potential crash detected! G-force: {g_force:.1f}g."
    if gps.get("lat"):
        msg += f" Location: {gps['lat']:.4f}, {gps['lng']:.4f}."
    audio = await text_to_speech("Crash detected! Calling emergency services in 5 seconds. Tap dismiss if you're okay.")
    return {"message": msg, "audio": audio}

class EmotionRequest(BaseModel):
    image: str

EMOTION_PROMPT = (
    "Look at this driver face. Respond with exactly ONE word.\n"
    "Only respond if you can clearly see the face and eyes.\n"
    "neutral / happy / sad / sleeping / unsure\n"
    "unsure = face not visible, blurry, or you are not confident.\n"
    "ONE WORD ONLY."
)

@app.post("/api/emotion")
async def detect_emotion(req: EmotionRequest):
    try:
        image_part = types.Part.from_bytes(
            data=base64.b64decode(req.image),
            mime_type="image/jpeg"
        )
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[image_part, EMOTION_PROMPT],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=5,

            )
        )
        raw = "".join(c for c in response.text.strip().lower() if c.isalpha())
        valid = {"neutral", "happy", "sad", "sleeping"}
        if raw not in valid:
            # unsure or unrecognised — skip, keep previous emotion on frontend
            logging.info(f"Emotion scan skipped: model returned '{raw}'")
            return {"emotion": None, "skipped": True}
        logging.info(f"Emotion detected: {raw}")
        return {"emotion": raw}
    except Exception as e:
        logging.error(f"Emotion detection error: {e}")
        return {"emotion": None, "skipped": True}

@app.get("/api/health")
async def health():
    return {"status": "ok", "trip_active": trip_active, "conversation_turns": len(conversation_history)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))
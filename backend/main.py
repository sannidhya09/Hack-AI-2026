import os
import base64
import asyncio
import httpx
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from google.genai import types
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional
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
MONGODB_URI    = os.getenv("MONGODB_URI")
VOICE_ID       = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

# ─── Gemini (new SDK) ──────────────────────────────
gemini_client = genai.Client(api_key=GEMINI_KEY)

# ─── MongoDB ───────────────────────────────────────
db = None
if MONGODB_URI and MONGODB_URI != "your_mongodb_uri":
    try:
        mongo_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        db = mongo_client.codriver
        logging.info("MongoDB connected")
    except Exception as e:
        logging.warning(f"MongoDB not available: {e}")

# ─── Conversation State ────────────────────────────
conversation_history = []

# ─── Models ───────────────────────────────────────
class AnalyzeRequest(BaseModel):
    trigger: str
    sensorData: Optional[dict] = {}
    emotion: Optional[str] = "neutral"
    gps: Optional[dict] = {}
    speedKmh: Optional[float] = 0
    driverMessage: Optional[str] = ""
    tripStats: Optional[dict] = {}

class CrashRequest(BaseModel):
    gps: Optional[dict] = {}
    sensorData: Optional[dict] = {}

class TripSummaryRequest(BaseModel):
    tripStats: dict
    drivingEvents: list
    durationSeconds: int
    maxSpeed: float

# ─────────────────────────────────────────────────────
#  SPEED LIMIT — OpenStreetMap (free, no billing)
# ─────────────────────────────────────────────────────

async def get_speed_limit(lat: float, lng: float) -> int:
    try:
        query = f"""
        [out:json][timeout:5];
        way(around:30,{lat},{lng})[maxspeed];
        out tags 1;
        """
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query}
            )
            data = r.json()
            elements = data.get("elements", [])
            if elements:
                maxspeed = elements[0].get("tags", {}).get("maxspeed", "")
                if maxspeed:
                    speed_str = maxspeed.replace("mph", "").replace("kmh", "").strip()
                    speed_val = int(''.join(filter(str.isdigit, speed_str)))
                    if "mph" in maxspeed:
                        return int(speed_val * 1.60934)
                    return speed_val
    except Exception as e:
        logging.warning(f"Speed limit lookup failed: {e}")
    return 56  # default 35mph in kmh

# ─────────────────────────────────────────────────────
#  ELEVENLABS TTS — Low Latency
# ─────────────────────────────────────────────────────

async def text_to_speech(text: str) -> str:
    if not ELEVENLABS_KEY or ELEVENLABS_KEY == "your_elevenlabs_key":
        return ""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream",
                headers={
                    "xi-api-key": ELEVENLABS_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg"
                },
                json={
                    "text": text,
                    "model_id": "eleven_turbo_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.3,
                        "use_speaker_boost": True
                    },
                    "optimize_streaming_latency": 4
                }
            )
            if r.status_code == 200:
                return base64.b64encode(r.content).decode('utf-8')
            else:
                logging.error(f"ElevenLabs error: {r.status_code} {r.text}")
    except Exception as e:
        logging.error(f"ElevenLabs exception: {e}")
    return ""

# ─────────────────────────────────────────────────────
#  GEMINI AI BRAIN
# ─────────────────────────────────────────────────────

CODRIVER_PERSONA = """You are CoDriver — a calm, warm, intelligent AI co-pilot.
You ride along with drivers and care about their safety and wellbeing.
You speak like a trusted friend who happens to know everything about driving.

VOICE RULES (critical — you are being read aloud):
- Maximum 2 sentences per response
- Natural, conversational tone — no robotic phrases
- Never say "I notice", "I detect", "as your AI"
- Use contractions: "you're", "it's", "don't"
- Vary your openings — never start with the same word twice in a row
- If warning, be firm but not scary
- If chatting, be warm and genuinely interested

PERSONALITY:
- Calm under pressure
- Subtly funny when appropriate
- Genuinely caring about the driver
- Direct when safety is at risk"""

async def get_ai_response(req: AnalyzeRequest, speed_limit_kmh: int) -> str:
    global conversation_history

    speed_limit_mph = round(speed_limit_kmh / 1.60934)
    speed_mph = round(req.speedKmh / 1.60934)
    trip_mins = req.tripStats.get("tripSecs", 0) // 60

    situation = f"""
SITUATION: {req.trigger}
Driver emotion: {req.emotion}
Speed: {speed_mph} mph (limit: {speed_limit_mph} mph)
Driving event just happened: {req.sensorData.get('event', 'none')}
Hard brakes this trip: {req.sensorData.get('hardBrakes', 0)}
Sharp turns this trip: {req.sensorData.get('sharpTurns', 0)}
Time driving: {trip_mins} minutes
Driver just said: "{req.driverMessage}"

TRIGGER GUIDE:
- speeding → warn about speed, keep it brief and friendly
- tired → empathize, suggest a break, maybe ask when they last slept
- stressed → acknowledge stress, calming tone, suggest deep breath
- happy → match their energy, warm conversation
- hard_brake → calmly acknowledge it, check if they're okay
- sharp_turn_right / sharp_turn_left → note the sharp turn
- hard_acceleration → gently note the aggressive acceleration
- swerve → ask if everything's alright
- driver_spoke → respond naturally to exactly what they said
- proactive → friendly check-in based on how the trip is going
- crash_warning → urgent but calm, tell them help is coming
"""

    history_context = "\n".join(conversation_history[-6:])
    full_prompt = f"{CODRIVER_PERSONA}\n\n{situation}\n\nRecent conversation:\n{history_context}"

    try:
        response = gemini_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.85,
                top_p=0.95,
                max_output_tokens=120,
            )
        )
        reply = response.text.strip()

        conversation_history.append(f"CoDriver said: {reply}")
        if len(conversation_history) > 10:
            conversation_history = conversation_history[-10:]

        return reply
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        fallbacks = {
            "speeding": "Hey, you're a bit over the speed limit — ease off just a touch.",
            "tired": "You're looking a little tired. Want to find somewhere to pull over for a bit?",
            "stressed": "Take a breath — you've got this. The road's all yours.",
            "happy": "Love the good vibes! Keep it up.",
            "hard_brake": "Whoa, nice reflexes. Everything alright up ahead?",
            "proactive": "Trip's going smoothly. You're doing great.",
        }
        return fallbacks.get(req.trigger, "Stay focused — you're doing well.")

# ─────────────────────────────────────────────────────
#  ML — DRIVING PATTERN ANALYSIS
# ─────────────────────────────────────────────────────

async def save_event(event_data: dict):
    if db is None:
        return
    try:
        event_data["timestamp"] = datetime.now()
        await db.driving_events.insert_one(event_data)
    except Exception as e:
        logging.warning(f"DB save error: {e}")

async def get_ml_tips() -> list:
    if db is None:
        return [
            "Connect MongoDB to track your driving patterns over time.",
            "Safe driving tip: maintain 3 seconds of following distance."
        ]
    try:
        events = await db.driving_events.find(
            {"event": {"$ne": "normal"}}
        ).sort("timestamp", -1).limit(200).to_list(200)

        if len(events) < 5:
            return ["Keep driving to build your personalized tips!"]

        tips = []
        hour_counts = {}
        event_type_counts = {}
        location_clusters = {}

        for e in events:
            if "timestamp" in e:
                hour = e["timestamp"].hour
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
            evt = e.get("event", "")
            event_type_counts[evt] = event_type_counts.get(evt, 0) + 1
            lat = e.get("lat")
            lng = e.get("lng")
            if lat and lng:
                grid_key = f"{round(lat, 3)},{round(lng, 3)}"
                location_clusters[grid_key] = location_clusters.get(grid_key, 0) + 1

        if hour_counts:
            worst_hour = max(hour_counts, key=hour_counts.get)
            count = hour_counts[worst_hour]
            if count >= 3:
                period = "morning" if 5 <= worst_hour < 12 else \
                         "afternoon" if 12 <= worst_hour < 17 else \
                         "evening" if 17 <= worst_hour < 21 else "night"
                tips.append(f"You tend to drive more aggressively in the {period} around {worst_hour}:00. Stay extra alert during that time.")

        if event_type_counts:
            worst = max(event_type_counts, key=event_type_counts.get)
            c = event_type_counts[worst]
            if c >= 3:
                messages = {
                    "hard_brake": f"You've had {c} hard braking events. Try increasing your following distance.",
                    "hard_acceleration": f"Frequent hard acceleration detected ({c} times). Smoother starts save fuel.",
                    "sharp_turn_left": f"You tend to take left turns sharply. Slow down a bit before turning.",
                    "sharp_turn_right": f"You tend to take right turns sharply. Ease into them.",
                    "swerve": f"You've had {c} swerving events. Make sure you're fully alert before driving.",
                }
                if worst in messages:
                    tips.append(messages[worst])

        if location_clusters:
            worst_spot = max(location_clusters, key=location_clusters.get)
            count = location_clusters[worst_spot]
            if count >= 3:
                tips.append(f"You've had {count} incidents near the same location. Be extra cautious in that area.")

        return tips[:3] if tips else ["Great driving! No patterns of concern detected yet."]
    except Exception as e:
        logging.error(f"ML tips error: {e}")
        return []

# ─────────────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "CoDriver running",
        "gemini": bool(GEMINI_KEY),
        "elevenlabs": bool(ELEVENLABS_KEY),
        "mongodb": db is not None,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    speed_limit_kmh = 56
    if req.gps.get("lat") and req.gps.get("lng"):
        speed_limit_kmh = await get_speed_limit(req.gps["lat"], req.gps["lng"])

    event = req.sensorData.get("event", "normal")
    if event != "normal":
        asyncio.create_task(save_event({
            "event": event,
            "accelY": req.sensorData.get("accelY", 0),
            "gyroZ": req.sensorData.get("gyroZ", 0),
            "speed": req.speedKmh,
            "lat": req.gps.get("lat"),
            "lng": req.gps.get("lng"),
            "emotion": req.emotion,
            "hour": datetime.now().hour
        }))

    reply = await get_ai_response(req, speed_limit_kmh)
    audio = await text_to_speech(reply)

    return {
        "reply": reply,
        "audio": audio,
        "speedLimit": speed_limit_kmh
    }

@app.post("/api/crash")
async def crash(req: CrashRequest):
    lat = req.gps.get("lat", 0)
    lng = req.gps.get("lng", 0)

    if db:
        asyncio.create_task(save_event({
            "event": "crash",
            "lat": lat,
            "lng": lng,
            "sensorData": req.sensorData,
            "hour": datetime.now().hour
        }))

    maps_url = f"https://maps.google.com/?q={lat},{lng}"
    return {"mapsUrl": maps_url, "lat": lat, "lng": lng}

@app.post("/api/trip-summary")
async def trip_summary(req: TripSummaryRequest):
    mins = req.durationSeconds // 60
    secs = req.durationSeconds % 60

    events_summary = {}
    for e in req.drivingEvents:
        evt = e.get("event", "unknown")
        events_summary[evt] = events_summary.get(evt, 0) + 1

    prompt = f"""Generate a friendly, encouraging trip summary (2-3 sentences max).
Trip data:
- Duration: {mins} minutes {secs} seconds
- Max speed: {round(req.maxSpeed / 1.60934)} mph
- Hard brakes: {events_summary.get('hard_brake', 0)}
- Hard accelerations: {events_summary.get('hard_acceleration', 0)}
- Sharp turns: {events_summary.get('sharp_turn_left', 0) + events_summary.get('sharp_turn_right', 0)}
- Swerves: {events_summary.get('swerve', 0)}

Be warm and specific. Mention what they did well. If there were issues, mention them gently.
End with something encouraging. Keep it conversational — this will be read aloud."""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=150)
        )
        summary_text = response.text.strip()
    except:
        hard_brakes = events_summary.get('hard_brake', 0)
        summary_text = f"Trip complete! You drove for {mins} minutes."
        summary_text += " Really smooth driving — no hard braking at all." if hard_brakes == 0 else f" You had {hard_brakes} hard braking moments to watch next time."
        summary_text += " Stay safe out there!"

    audio = await text_to_speech(summary_text)
    return {"summary": summary_text, "audio": audio}

@app.get("/api/tips")
async def tips():
    return {"tips": await get_ml_tips()}

@app.post("/api/music")
async def music_search(data: dict):
    query = data.get("query", "")
    encoded = query.replace(" ", "+")
    return {
        "youtubeUrl": f"https://www.youtube.com/results?search_query={encoded}",
        "spotifyUrl": f"https://open.spotify.com/search/{encoded}",
        "query": query
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
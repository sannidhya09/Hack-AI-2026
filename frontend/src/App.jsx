import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "./components/Header";
import SpeedCard from "./components/SpeedCard";
import StatsRow from "./components/StatsRow";
import DriverStatus from "./components/DriverStatus";
import ConversationPanel from "./components/ConversationPanel";
import CrashAlert from "./components/CrashAlert";
import TripSummary from "./components/TripSummary";
import MusicModal from "./components/MusicModal";
import TipsPanel from "./components/TipsPanel";

const ESP32_WS      = import.meta.env.VITE_ESP32_WS || "ws://192.168.4.1:81";
const BACKEND       = import.meta.env.VITE_BACKEND_URL || "";
const SPEED_WARN_MS = 30000;
const PROACTIVE_MS  = 900000; // 15 min
const EVENT_COOL_MS = 12000;
const EMOTION_COOL_MS = 30000;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function App() {
  // ─── State ────────────────────────────────────────
  const [sensorData,     setSensorData]     = useState(null);
  const [emotion,        setEmotion]        = useState("neutral");
  const [gps,            setGps]            = useState({ lat: null, lng: null });
  const [speedKmh,       setSpeedKmh]       = useState(0);
  const [speedLimit,     setSpeedLimit]     = useState(56);
  const [connected,      setConnected]      = useState(false);
  const [conversation,   setConversation]   = useState([]);
  const [tips,           setTips]           = useState([]);
  const [listening,      setListening]      = useState(false);
  const [aiSpeaking,     setAiSpeaking]     = useState(false);
  const [micVolume,      setMicVolume]      = useState(0);
  const [audioStarted,   setAudioStarted]   = useState(false);

  // Sensor counters — set directly from ESP32 cumulative counts
  const [hardBrakes,     setHardBrakes]     = useState(0);
  const [sharpTurns,     setSharpTurns]     = useState(0);
  const [hardAccels,     setHardAccels]     = useState(0);
  const [currentGForce,  setCurrentGForce]  = useState(0);

  // UI
  const [crashAlert,  setCrashAlert]  = useState(false);
  const [crashData,   setCrashData]   = useState(null);
  const [tripEnded,   setTripEnded]   = useState(false);
  const [tripSummary, setTripSummary] = useState(null);
  const [musicModal,  setMusicModal]  = useState(false);
  const [musicData,   setMusicData]   = useState(null);
  const [maxSpeed,    setMaxSpeed]    = useState(0);
  const [tripStartTime] = useState(Date.now());

  // ─── Refs (stable across renders, safe in closures) ──
  // Use a single "live state" ref object so we never have stale closure issues
  const live = useRef({
    speed: 0, limit: 56, emotion: "neutral",
    gps: { lat: null, lng: null },
    hardBrakes: 0, sharpTurns: 0, hardAccels: 0, gForce: 0,
    currentEvent: "normal",
    aiSpeaking: false, audioStarted: false,
  });

  // Keep live ref synced with state
  useEffect(() => { live.current.speed       = speedKmh;     }, [speedKmh]);
  useEffect(() => { live.current.limit       = speedLimit;   }, [speedLimit]);
  useEffect(() => { live.current.emotion     = emotion;      }, [emotion]);
  useEffect(() => { live.current.gps         = gps;          }, [gps]);
  useEffect(() => { live.current.hardBrakes  = hardBrakes;   }, [hardBrakes]);
  useEffect(() => { live.current.sharpTurns  = sharpTurns;   }, [sharpTurns]);
  useEffect(() => { live.current.hardAccels  = hardAccels;   }, [hardAccels]);
  useEffect(() => { live.current.gForce      = currentGForce;}, [currentGForce]);
  useEffect(() => { live.current.aiSpeaking  = aiSpeaking;   }, [aiSpeaking]);
  useEffect(() => { live.current.audioStarted= audioStarted; }, [audioStarted]);

  // Other refs
  const wsRef            = useRef(null);
  const wsRetryRef       = useRef(null);
  const lastPosRef       = useRef(null);
  const speedHistoryRef  = useRef([]);
  const prevSpeedRef     = useRef(0);
  const prevSpeedTimeRef = useRef(Date.now());
  const lastSpeedWarnRef = useRef(0);
  const lastProactiveRef = useRef(Date.now());
  const lastEventRef     = useRef(0);
  const lastEmotionRef   = useRef(0);
  const crashTimerRef    = useRef(null);
  const stopTimerRef     = useRef(null);
  const recognitionRef   = useRef(null);
  const audioCtxRef      = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const tripStartRef     = useRef(tripStartTime);

  // ─── iOS Audio Unlock ─────────────────────────────
  const unlockAudio = async () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      // Play silent buffer to unlock iOS
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      audioCtxRef.current = ctx;
      setAudioStarted(true);
      live.current.audioStarted = true;
      startMic(ctx);
      // First proactive message after 1.5s
      setTimeout(() => callAnalyze("proactive"), 1500);
    } catch (e) {
      console.warn("Audio unlock:", e);
      setAudioStarted(true);
      live.current.audioStarted = true;
    }
  };

  // ─── GPS + Speed ──────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const now = Date.now();

        let spd = 0;
        // Native GPS speed is most accurate when available
        if (pos.coords.speed !== null && pos.coords.speed >= 0) {
          spd = pos.coords.speed * 3.6;
        } else if (lastPosRef.current) {
          const dt   = (now - lastPosRef.current.time) / 1000;
          const dist = haversine(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
          if (dt > 0 && dt < 3) spd = (dist / dt) * 3.6;
        }
        spd = Math.min(spd, 200); // cap noise spikes

        lastPosRef.current = { lat, lng, time: now };

        // 5-sample rolling average
        const hist = speedHistoryRef.current;
        hist.push(spd);
        if (hist.length > 5) hist.shift();
        const smoothed = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);

        setGps({ lat, lng });
        setSpeedKmh(smoothed);
        setMaxSpeed(prev => Math.max(prev, smoothed));

        // Crash detection: >48 km/h drop in <1.5s while moving
        const drop = prevSpeedRef.current - spd;
        const dt2  = (now - prevSpeedTimeRef.current) / 1000;
        if (drop > 48 && dt2 < 1.5 && prevSpeedRef.current > 30) triggerCrash();

        // Trip end: stopped for 30s
        if (smoothed < 3 && prevSpeedRef.current > 10) {
          stopTimerRef.current = setTimeout(() => {
            if (live.current.speed < 3) endTrip();
          }, 30000);
        } else if (smoothed > 5 && stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }

        prevSpeedRef.current     = spd;
        prevSpeedTimeRef.current = now;
      },
      (err) => console.warn("GPS:", err.message),
      { enableHighAccuracy: true, maximumAge: 500, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ─── WebSocket — ESP32 sensor data ───────────────
  // IMPORTANT: No useCallback with stale closure. Use a ref-based retry
  // so we always call the latest version of connectWS.
  const connectWSRef = useRef(null);
  connectWSRef.current = function connectWS() {
    clearTimeout(wsRetryRef.current);
    try {
      const ws = new WebSocket(ESP32_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✓ ESP32 WebSocket connected");
        setConnected(true);
      };

      ws.onclose = () => {
        setConnected(false);
        wsRetryRef.current = setTimeout(() => connectWSRef.current(), 3000);
      };

      ws.onerror = () => {
        // onclose fires after onerror, so just close
        ws.close();
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);

          // ESP32 firmware sends:
          // { accelX, accelY, accelZ, gyroX, gyroY, gyroZ,
          //   event, hardBrakes, sharpTurns, hardAccels, tripTime, audioLevel }
          // Accept any message that has sensor fields (don't require data.type === "sensors")
          if (
            data.accelX !== undefined ||
            data.accelY !== undefined ||
            data.event  !== undefined ||
            data.hardBrakes !== undefined
          ) {
            const ax = parseFloat(data.accelX) || 0;
            const ay = parseFloat(data.accelY) || 0;
            const az = parseFloat(data.accelZ) || 0;
            const gForce = parseFloat(Math.sqrt(ax*ax + ay*ay + az*az).toFixed(2));

            // ── These are cumulative counts sent by ESP32 ──
            const hb = parseInt(data.hardBrakes) || 0;
            const st = parseInt(data.sharpTurns) || 0;
            const ha = parseInt(data.hardAccels) || 0;
            const evt = data.event || "normal";

            setHardBrakes(hb);
            setSharpTurns(st);
            setHardAccels(ha);
            setCurrentGForce(gForce);
            live.current.hardBrakes  = hb;
            live.current.sharpTurns  = st;
            live.current.hardAccels  = ha;
            live.current.gForce      = gForce;
            live.current.currentEvent = evt;

            setSensorData({
              event: evt,
              accelX: ax, accelY: ay, accelZ: az,
              gyroX: parseFloat(data.gyroX) || 0,
              gyroY: parseFloat(data.gyroY) || 0,
              gyroZ: parseFloat(data.gyroZ) || 0,
              hardBrakes: hb,
              sharpTurns: st,
              hardAccels: ha,
              gForce,
              audioLevel: parseFloat(data.audioLevel) || 0,
            });
          }
        } catch (err) {
          console.warn("WS parse error:", err);
        }
      };
    } catch (err) {
      wsRetryRef.current = setTimeout(() => connectWSRef.current(), 3000);
    }
  };

  useEffect(() => {
    connectWSRef.current();
    return () => {
      clearTimeout(wsRetryRef.current);
      wsRef.current?.close();
    };
  }, []);

  // ─── Voice Recognition ────────────────────────────
  useEffect(() => {
    if (!audioStarted) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = false;
    rec.lang           = "en-US";

    rec.onstart  = () => setListening(true);
    rec.onend    = () => {
      setListening(false);
      if (!live.current.aiSpeaking) {
        setTimeout(() => { try { rec.start(); } catch {} }, 500);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") return;
      setTimeout(() => { try { rec.start(); } catch {} }, 2000);
    };
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (text.length > 1) handleDriverSpoke(text);
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch {}
    return () => { try { rec.stop(); } catch {} };
  }, [audioStarted]);

  // ─── Mic Volume ───────────────────────────────────
  const startMic = async (existingCtx) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx    = existingCtx || audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
      const tick = () => {
        analyserRef.current?.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setMicVolume(Math.round(avg));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  };

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
  }, []);

  // ─── Main Analysis Loop ───────────────────────────
  useEffect(() => {
    if (!audioStarted) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const l   = live.current;

      // 1. Speeding
      if (l.speed > l.limit + 5 && now - lastSpeedWarnRef.current > SPEED_WARN_MS) {
        lastSpeedWarnRef.current = now;
        callAnalyze("speeding");
        return;
      }
      // 2. Hardware sensor event
      if (l.currentEvent && l.currentEvent !== "normal" && now - lastEventRef.current > EVENT_COOL_MS) {
        lastEventRef.current = now;
        callAnalyze(l.currentEvent);
        return;
      }
      // 3. Emotion
      if ((l.emotion === "tired" || l.emotion === "stressed") && now - lastEmotionRef.current > EMOTION_COOL_MS) {
        lastEmotionRef.current = now;
        callAnalyze(l.emotion);
        return;
      }
      // 4. Proactive — every 15 min
      if (now - lastProactiveRef.current > PROACTIVE_MS) {
        lastProactiveRef.current = now;
        callAnalyze("proactive");
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [audioStarted]);

  // ─── Load Tips ────────────────────────────────────
  useEffect(() => {
    axios.get(`${BACKEND}/api/tips`).then(r => setTips(r.data.tips)).catch(() => {});
  }, []);

  // ─── Core Functions ───────────────────────────────
  const callAnalyze = async (trigger, driverMessage = "") => {
    if (live.current.aiSpeaking) return;
    const l = live.current;
    try {
      const res = await axios.post(`${BACKEND}/api/analyze`, {
        trigger,
        sensorData: {
          event:      l.currentEvent,
          hardBrakes: l.hardBrakes,
          sharpTurns: l.sharpTurns,
          hardAccels: l.hardAccels,
          gForce:     l.gForce,
        },
        emotion:      l.emotion,
        gps:          l.gps,
        speedKmh:     l.speed,
        driverMessage,
        tripStats: { tripSecs: Math.round((Date.now() - tripStartRef.current) / 1000) }
      });
      const { reply, audio, speedLimit: sl } = res.data;
      if (sl && sl > 0) setSpeedLimit(sl);
      addMessage("CoDriver", reply, trigger);
      if (audio) playAudio(audio);
    } catch (e) {
      console.error("Analyze error:", e.message);
    }
  };

  const handleDriverSpoke = (text) => {
    const musicKw = ["play music", "play some music", "put on music", "play song", "play spotify", "play youtube"];
    if (musicKw.some(k => text.toLowerCase().includes(k))) {
      handleMusicRequest(text);
      return;
    }
    addMessage("You", text, "driver");
    callAnalyze("driver_spoke", text);
  };

  const handleMusicRequest = async (query) => {
    addMessage("You", query, "driver");
    try {
      const res = await axios.post(`${BACKEND}/api/music`, { query });
      setMusicData(res.data);
      setMusicModal(true);
      addMessage("CoDriver", "Opening music for you!", "music");
    } catch {
      callAnalyze("driver_spoke", query);
    }
  };

  const addMessage = (sender, text, type = "normal") => {
    setConversation(prev => [
      ...prev.slice(-30),
      { sender, text, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
  };

  const playAudio = (b64) => {
    setAiSpeaking(true);
    live.current.aiSpeaking = true;
    try { recognitionRef.current?.stop(); } catch {}
    const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
    const done = () => {
      setAiSpeaking(false);
      live.current.aiSpeaking = false;
      setTimeout(() => { try { recognitionRef.current?.start(); } catch {} }, 500);
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  };

  const triggerCrash = async () => {
    if (crashTimerRef.current) return; // already triggered
    navigator.vibrate?.([300, 100, 300, 100, 300]);
    setCrashAlert(true);
    try {
      const res = await axios.post(`${BACKEND}/api/crash`, {
        gps: live.current.gps,
        sensorData: { gForce: live.current.gForce }
      });
      setCrashData(res.data);
    } catch {}
    crashTimerRef.current = setTimeout(() => {
      window.location.href = "tel:911";
    }, 5000);
  };

  const dismissCrash = () => {
    setCrashAlert(false);
    setCrashData(null);
    clearTimeout(crashTimerRef.current);
    crashTimerRef.current = null;
  };

  const endTrip = async () => {
    if (tripEnded) return;
    setTripEnded(true);
    try {
      const duration = Math.round((Date.now() - tripStartRef.current) / 1000);
      const res = await axios.post(`${BACKEND}/api/trip-summary`, {
        tripStats:       { tripSecs: duration },
        drivingEvents:   [],
        durationSeconds: duration,
        maxSpeed:        maxSpeed,
        hardBrakes:      live.current.hardBrakes,
        sharpTurns:      live.current.sharpTurns,
        hardAccels:      live.current.hardAccels,
      });
      setTripSummary(res.data);
      if (res.data.audio) playAudio(res.data.audio);
    } catch {}
  };

  // ─── Start Screen ─────────────────────────────────
  if (!audioStarted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 max-w-md mx-auto">
        <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center shadow-lg mb-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M12 12l9-5M12 12v10M12 12L3 7" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-2 text-center">
          Co <span className="text-red-600">Driver</span>
        </h1>
        <p className="text-gray-400 text-center mb-12 text-lg">Your AI co-pilot is ready</p>
        <div className="w-full space-y-3 mb-8">
          {[
            "🎙️ Listens to your voice",
            "🔬 Reads hardware sensors in real time",
            "🧠 AI responds naturally via Gemini",
            "🚨 Emergency crash detection",
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
              <span className="text-lg">{f.split(" ")[0]}</span>
              <span className="text-sm text-gray-600">{f.split(" ").slice(1).join(" ")}</span>
            </div>
          ))}
        </div>
        <button
          onClick={unlockAudio}
          className="w-full bg-red-600 text-white font-bold py-5 rounded-3xl text-xl shadow-lg active:scale-95 transition-transform"
        >
          Start CoDriver 🚗
        </button>
        <p className="text-xs text-gray-300 mt-4 text-center">Tap to enable voice & audio</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto relative">
      {crashAlert && <CrashAlert crashData={crashData} onDismiss={dismissCrash} />}
      {tripSummary && <TripSummary summary={tripSummary} onClose={() => setTripSummary(null)} />}
      {musicModal && musicData && <MusicModal data={musicData} onClose={() => setMusicModal(false)} />}

      <div className="pb-6">
        <Header
          connected={connected}
          listening={listening}
          aiSpeaking={aiSpeaking}
          micVolume={micVolume}
        />
        <div className="px-4 space-y-3">
          <SpeedCard
            speedKmh={speedKmh}
            speedLimit={speedLimit}
            sensorData={sensorData}
          />
          <StatsRow
            hardBrakes={hardBrakes}
            sharpTurns={sharpTurns}
            hardAccels={hardAccels}
            currentGForce={currentGForce}
            tripStartTime={tripStartTime}
          />
          <DriverStatus
            emotion={emotion}
            setEmotion={setEmotion}
            gps={gps}
          />
          {tips.length > 0 && <TipsPanel tips={tips} />}
          <ConversationPanel
            conversation={conversation}
            aiSpeaking={aiSpeaking}
            listening={listening}
            micVolume={micVolume}
          />
        </div>
      </div>
    </div>
  );
}
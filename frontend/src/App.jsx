import { useState, useEffect, useRef, useCallback } from "react";
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
import WaveformBar from "./components/WaveformBar";

const ESP32_WS      = import.meta.env.VITE_ESP32_WS || "ws://192.168.4.1:81";
const BACKEND       = import.meta.env.VITE_BACKEND_URL || "";
const SPEED_WARN_MS = 15000;
const PROACTIVE_MS  = 45000;
const EVENT_COOL_MS = 12000;
const EMOTION_COOL_MS = 20000;

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function App() {
  // ─── Core State ────────────────────────────────
  const [sensorData, setSensorData]     = useState(null);
  const [emotion, setEmotion]           = useState("neutral");
  const [gps, setGps]                   = useState({ lat: null, lng: null });
  const [speedKmh, setSpeedKmh]         = useState(0);
  const [speedLimit, setSpeedLimit]     = useState(56);
  const [connected, setConnected]       = useState(false);
  const [conversation, setConversation] = useState([]);
  const [tips, setTips]                 = useState([]);
  const [listening, setListening]       = useState(false);
  const [aiSpeaking, setAiSpeaking]     = useState(false);
  const [micVolume, setMicVolume]       = useState(0);

  // ─── UI State ──────────────────────────────────
  const [crashAlert, setCrashAlert]     = useState(false);
  const [crashData, setCrashData]       = useState(null);
  const [tripEnded, setTripEnded]       = useState(false);
  const [tripSummary, setTripSummary]   = useState(null);
  const [musicModal, setMusicModal]     = useState(false);
  const [musicData, setMusicData]       = useState(null);
  const [tripStartTime]                 = useState(Date.now());
  const [drivingEvents, setDrivingEvents] = useState([]);
  const [maxSpeed, setMaxSpeed]         = useState(0);

  // ─── Refs (no re-render needed) ────────────────
  const wsRef            = useRef(null);
  const lastPosRef       = useRef(null);
  const lastSpeedWarnRef = useRef(0);
  const lastProactiveRef = useRef(0);
  const lastEventRef     = useRef(0);
  const lastEmotionRef   = useRef(0);
  const crashTimerRef    = useRef(null);
  const stopTimerRef     = useRef(null);
  const prevSpeedRef     = useRef(0);
  const prevSpeedTimeRef = useRef(Date.now());
  const recognitionRef   = useRef(null);
  const audioCtxRef      = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);

  // Live refs for callbacks
  const sensorRef     = useRef(null);
  const speedRef      = useRef(0);
  const emotionRef    = useRef("neutral");
  const gpsRef        = useRef({ lat: null, lng: null });
  const limitRef      = useRef(56);
  const eventsRef     = useRef([]);

  useEffect(() => { sensorRef.current  = sensorData; }, [sensorData]);
  useEffect(() => { speedRef.current   = speedKmh; }, [speedKmh]);
  useEffect(() => { emotionRef.current = emotion; }, [emotion]);
  useEffect(() => { gpsRef.current     = gps; }, [gps]);
  useEffect(() => { limitRef.current   = speedLimit; }, [speedLimit]);
  useEffect(() => { eventsRef.current  = drivingEvents; }, [drivingEvents]);

  // ─── GPS + Speed + Crash Detection ─────────────
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const now = Date.now();
        let spd = pos.coords.speed ? pos.coords.speed * 3.6 : 0;

        if (lastPosRef.current) {
          const dt   = (now - lastPosRef.current.time) / 1000;
          const dist = haversine(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
          if (dt > 0 && dt < 5) spd = Math.max(spd, (dist / dt) * 3.6);
        }

        lastPosRef.current = { lat, lng, time: now };
        setGps({ lat, lng });
        const rounded = Math.round(spd);
        setSpeedKmh(rounded);
        setMaxSpeed(prev => Math.max(prev, rounded));

        // Vibrate API for haptic feedback
        if (navigator.vibrate) {
          const limitKmh = limitRef.current;
          if (rounded > limitKmh + 10) navigator.vibrate([50, 50, 50]);
        }

        // ── Crash detection: >48 kmh drop in <1.5s ──
        const speedDrop = prevSpeedRef.current - spd;
        const timeDiff  = (now - prevSpeedTimeRef.current) / 1000;
        if (speedDrop > 48 && timeDiff < 1.5 && prevSpeedRef.current > 30 && !crashAlert) {
          triggerCrash();
        }

        // ── Stopped detection for trip summary ──
        if (rounded < 3 && prevSpeedRef.current > 10) {
          stopTimerRef.current = setTimeout(() => {
            if (speedRef.current < 3) endTrip();
          }, 30000);
        } else if (rounded > 5 && stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }

        prevSpeedRef.current     = spd;
        prevSpeedTimeRef.current = now;
      },
      (err) => console.log("GPS:", err.message),
      { enableHighAccuracy: true, maximumAge: 500, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [crashAlert]);

  // ─── WebSocket ESP32 ───────────────────────────
  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, []);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(ESP32_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log("ESP32 connected");
      };

      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "sensors") {
            setSensorData(data);
            // Track events for trip summary
            if (data.event && data.event !== "normal") {
              setDrivingEvents(prev => [...prev, { event: data.event, time: Date.now() }]);
            }
          }
        } catch {}
      };
    } catch {
      setTimeout(connect, 3000);
    }
  }, []);

  // ─── Voice Recognition (phone mic) ────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = false;
    rec.lang           = "en-US";
    rec.maxAlternatives = 1;

    rec.onstart  = () => setListening(true);
    rec.onend    = () => {
      setListening(false);
      if (!aiSpeaking) {
        setTimeout(() => { try { rec.start(); } catch {} }, 800);
      }
    };
    rec.onerror  = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setTimeout(() => { try { rec.start(); } catch {} }, 2000);
      }
    };
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (text) handleDriverSpoke(text);
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch {}

    return () => { try { rec.stop(); } catch {} };
  }, []);

  // ─── Mic Volume Visualization ──────────────────
  useEffect(() => {
    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const source  = audioCtxRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);

        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        const tick = () => {
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setMicVolume(Math.round(avg));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    }
    setupAudio();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // ─── Main Analysis Loop ────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now    = Date.now();
      const sensor = sensorRef.current;
      const spd    = speedRef.current;
      const limit  = limitRef.current;
      const emo    = emotionRef.current;

      if (!sensor && spd === 0) return;

      // Speeding
      if (spd > limit && now - lastSpeedWarnRef.current > SPEED_WARN_MS) {
        lastSpeedWarnRef.current = now;
        callAnalyze("speeding");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return;
      }

      // Driving event
      const event = sensor?.event;
      if (event && event !== "normal" && now - lastEventRef.current > EVENT_COOL_MS) {
        lastEventRef.current = now;
        callAnalyze(event);
        return;
      }

      // Emotion
      if ((emo === "tired" || emo === "stressed") && now - lastEmotionRef.current > EMOTION_COOL_MS) {
        lastEmotionRef.current = now;
        callAnalyze(emo);
        return;
      }

      if (emo === "happy" && now - lastEmotionRef.current > EMOTION_COOL_MS * 2) {
        lastEmotionRef.current = now;
        callAnalyze("happy");
        return;
      }

      // Proactive check-in
      if (now - lastProactiveRef.current > PROACTIVE_MS) {
        lastProactiveRef.current = now;
        callAnalyze("proactive");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // ─── Load Tips ─────────────────────────────────
  useEffect(() => {
    axios.get(`${BACKEND}/api/tips`)
      .then(r => setTips(r.data.tips))
      .catch(() => {});
  }, []);

  // ─── Core Functions ────────────────────────────
  const callAnalyze = async (trigger, driverMessage = "") => {
    if (aiSpeaking) return;
    try {
      const res = await axios.post(`${BACKEND}/api/analyze`, {
        trigger,
        sensorData:   sensorRef.current || {},
        emotion:      emotionRef.current,
        gps:          gpsRef.current,
        speedKmh:     speedRef.current,
        driverMessage,
        tripStats: {
          tripSecs: Math.round((Date.now() - tripStartTime) / 1000)
        }
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
    // Check for music commands
    const musicKeywords = ["play", "music", "song", "spotify", "youtube"];
    if (musicKeywords.some(k => text.toLowerCase().includes(k))) {
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
      addMessage("CoDriver", `Opening music for "${res.data.query}" — pick your platform!`, "music");
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
    // Stop recognition while speaking to avoid feedback
    try { recognitionRef.current?.stop(); } catch {}

    const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
    audio.onended = () => {
      setAiSpeaking(false);
      setTimeout(() => {
        try { recognitionRef.current?.start(); } catch {}
      }, 500);
    };
    audio.onerror = () => {
      setAiSpeaking(false);
      setTimeout(() => {
        try { recognitionRef.current?.start(); } catch {}
      }, 500);
    };
    audio.play().catch(() => setAiSpeaking(false));
  };

  const triggerCrash = async () => {
    setCrashAlert(true);
    navigator.vibrate?.([300, 100, 300, 100, 300]);

    try {
      const res = await axios.post(`${BACKEND}/api/crash`, {
        gps: gpsRef.current,
        sensorData: sensorRef.current
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
    addMessage("CoDriver", "Glad you're okay! Take a breath and drive safe.", "normal");
    callAnalyze("proactive", "false alarm on the crash detection");
  };

  const endTrip = async () => {
    if (tripEnded) return;
    setTripEnded(true);
    try {
      const duration = Math.round((Date.now() - tripStartTime) / 1000);
      const res = await axios.post(`${BACKEND}/api/trip-summary`, {
        tripStats: { tripSecs: duration },
        drivingEvents: eventsRef.current,
        durationSeconds: duration,
        maxSpeed: maxSpeed
      });
      setTripSummary(res.data);
      if (res.data.audio) playAudio(res.data.audio);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto relative">

      {/* Crash Alert Overlay */}
      {crashAlert && (
        <CrashAlert
          crashData={crashData}
          onDismiss={dismissCrash}
        />
      )}

      {/* Trip Summary Modal */}
      {tripSummary && (
        <TripSummary
          summary={tripSummary}
          onClose={() => setTripSummary(null)}
        />
      )}

      {/* Music Modal */}
      {musicModal && musicData && (
        <MusicModal
          data={musicData}
          onClose={() => setMusicModal(false)}
        />
      )}

      {/* Main UI */}
      <div className="pb-6 safe-bottom">
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
            sensorData={sensorData}
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

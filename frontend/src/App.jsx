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

axios.defaults.timeout = 55000;

const BACKEND        = import.meta.env.VITE_BACKEND_URL || "";

// BLE UUIDs — must match CoDriver_BLE.ino exactly
const BLE_SERVICE_UUID        = "12345678-1234-1234-1234-123456789abc";
const BLE_CHARACTERISTIC_UUID = "abcdefab-cdef-abcd-efab-cdefabcdefab";
const SPEED_WARN_MS  = 30000;
const PROACTIVE_MS   = 300000;
const EVENT_COOL_MS  = 12000;
const EMOTION_COOL_MS = 60000;
const WAKE_LISTEN_MS = 10000; // listen window after Nina / after AI speaks

const WAKE_WORD = "nina"; // lowercase for comparison

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function App() {
  const [sensorData,    setSensorData]    = useState(null);
  const [emotion,       setEmotion]       = useState("neutral");
  const [gps,           setGps]           = useState({ lat: null, lng: null });
  const [speedKmh,      setSpeedKmh]      = useState(0);
  const [speedLimit,    setSpeedLimit]    = useState(56);
  const [connected,     setConnected]     = useState(false);
  const [conversation,  setConversation]  = useState([]);
  const [aiSpeaking,    setAiSpeaking]    = useState(false);
  const [audioStarted,  setAudioStarted]  = useState(false);
  const [tripStarted,   setTripStarted]   = useState(false);
  const [hardBrakes,    setHardBrakes]    = useState(0);
  const [sharpTurns,    setSharpTurns]    = useState(0);
  const [hardAccels,    setHardAccels]    = useState(0);
  const [currentGForce, setCurrentGForce] = useState(0);
  const [crashAlert,    setCrashAlert]    = useState(false);
  const [crashData,     setCrashData]     = useState(null);
  const [tripEnded,     setTripEnded]     = useState(false);
  const [tripSummary,   setTripSummary]   = useState(null);
  const [musicModal,    setMusicModal]    = useState(false);
  const [musicData,     setMusicData]     = useState(null);
  const [maxSpeed,      setMaxSpeed]      = useState(0);
  const [micVolume,     setMicVolume]     = useState(0);

  // Wake word UI state — "wake" = waiting for Nina, "active" = open listen window
  const [listenMode, setListenMode] = useState("wake");

  const tripStartTimeRef = useRef(Date.now());

  const live = useRef({
    speed: 0, limit: 56, emotion: "neutral",
    gps: { lat: null, lng: null },
    hardBrakes: 0, sharpTurns: 0, hardAccels: 0, gForce: 0,
    currentEvent: "normal",
    aiSpeaking: false, audioStarted: false, tripStarted: false,
    listenMode: "wake", // "wake" | "active"
  });

  useEffect(() => { live.current.speed        = speedKmh;      }, [speedKmh]);
  useEffect(() => { live.current.limit        = speedLimit;    }, [speedLimit]);
  useEffect(() => { live.current.emotion      = emotion;       }, [emotion]);
  useEffect(() => { live.current.gps          = gps;           }, [gps]);
  useEffect(() => { live.current.hardBrakes   = hardBrakes;    }, [hardBrakes]);
  useEffect(() => { live.current.sharpTurns   = sharpTurns;    }, [sharpTurns]);
  useEffect(() => { live.current.hardAccels   = hardAccels;    }, [hardAccels]);
  useEffect(() => { live.current.gForce       = currentGForce; }, [currentGForce]);
  useEffect(() => { live.current.aiSpeaking   = aiSpeaking;    }, [aiSpeaking]);
  useEffect(() => { live.current.audioStarted = audioStarted;  }, [audioStarted]);
  useEffect(() => { live.current.tripStarted  = tripStarted;   }, [tripStarted]);
  useEffect(() => { live.current.listenMode   = listenMode;    }, [listenMode]);

  const bleDeviceRef     = useRef(null);
  const bleCharRef       = useRef(null);
  const lastPosRef       = useRef(null);
  const speedHistoryRef  = useRef([]);
  const prevSpeedRef     = useRef(0);
  const prevSpeedTimeRef = useRef(Date.now());
  const lastSpeedWarnRef = useRef(0);
  const lastProactiveRef = useRef(Date.now());
  const lastEventRef     = useRef(0);
  const lastEmotionRef   = useRef(0);
  const crashTimerRef    = useRef(null);
  const recognitionRef   = useRef(null);
  const audioCtxRef      = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const persistentAudio  = useRef(null);
  const wakeWindowRef    = useRef(null); // timer that closes the active listen window

  // ─── Wake Word Helpers ────────────────────────────
  // Open a 10s window where all speech is treated as driver input
  const openListenWindow = () => {
    clearTimeout(wakeWindowRef.current);
    setListenMode("active");
    live.current.listenMode = "active";
    wakeWindowRef.current = setTimeout(() => {
      setListenMode("wake");
      live.current.listenMode = "wake";
    }, WAKE_LISTEN_MS);
  };

  // Close the window immediately (called when driver sends a message)
  const closeListenWindow = () => {
    clearTimeout(wakeWindowRef.current);
    setListenMode("wake");
    live.current.listenMode = "wake";
  };

  // ─── iOS Audio Unlock ─────────────────────────────
  const unlockAudio = async () => {
    const pa = new Audio();
    pa.preload = "auto";
    pa.src = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV";
    try { await pa.play(); pa.pause(); pa.currentTime = 0; } catch {}
    persistentAudio.current = pa;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      audioCtxRef.current = ctx;
      startMic(ctx);
    } catch (e) {
      console.warn("AudioContext setup:", e);
    }
    setAudioStarted(true);
    live.current.audioStarted = true;
  };

  // ─── Audio Playback ───────────────────────────────
  const playAudio = (b64) => {
    setAiSpeaking(true);
    live.current.aiSpeaking = true;
    try { recognitionRef.current?.stop(); } catch {}

    const done = () => {
      setAiSpeaking(false);
      live.current.aiSpeaking = false;
      // After AI finishes speaking, open 10s listen window
      openListenWindow();
      setTimeout(() => { try { recognitionRef.current?.start(); } catch {} }, 300);
    };

    const doPlay = async () => {
      try {
        const pa = persistentAudio.current;
        if (!pa) { done(); return; }
        try { pa.pause(); pa.currentTime = 0; } catch {}
        const binary = atob(b64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url  = URL.createObjectURL(blob);
        pa.onended = () => { URL.revokeObjectURL(url); done(); };
        pa.onerror = () => { URL.revokeObjectURL(url); done(); };
        pa.src = url;
        pa.load();
        try {
          await pa.play();
        } catch (err) {
          console.warn("Persistent audio failed, using fallback:", err.message);
          URL.revokeObjectURL(url);
          const binary2 = atob(b64);
          const bytes2  = new Uint8Array(binary2.length);
          for (let i = 0; i < binary2.length; i++) bytes2[i] = binary2.charCodeAt(i);
          const blob2 = new Blob([bytes2], { type: "audio/mpeg" });
          const url2  = URL.createObjectURL(blob2);
          const fallback = new Audio(url2);
          fallback.onended = () => { URL.revokeObjectURL(url2); done(); };
          fallback.onerror = () => { URL.revokeObjectURL(url2); done(); };
          fallback.play().catch(() => { URL.revokeObjectURL(url2); done(); });
        }
      } catch (e) {
        console.warn("doPlay error:", e);
        done();
      }
    };
    doPlay();
  };

  // ─── GPS + Speed ──────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const now = Date.now();
        let spd = 0;
        if (pos.coords.speed !== null && pos.coords.speed >= 0) {
          spd = pos.coords.speed * 3.6;
        } else if (lastPosRef.current) {
          const dt   = (now - lastPosRef.current.time) / 1000;
          const dist = haversine(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
          if (dt > 0 && dt < 3) spd = (dist / dt) * 3.6;
        }
        spd = Math.min(spd, 200);
        lastPosRef.current = { lat, lng, time: now };
        const hist = speedHistoryRef.current;
        hist.push(spd);
        if (hist.length > 5) hist.shift();
        const smoothed = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);
        setGps({ lat, lng });
        setSpeedKmh(smoothed);
        setMaxSpeed(prev => Math.max(prev, smoothed));
        const drop = prevSpeedRef.current - spd;
        const dt2  = (now - prevSpeedTimeRef.current) / 1000;
        if (drop > 48 && dt2 < 1.5 && prevSpeedRef.current > 30) triggerCrash();
        prevSpeedRef.current     = spd;
        prevSpeedTimeRef.current = now;
      },
      (err) => console.warn("GPS:", err.message),
      { enableHighAccuracy: true, maximumAge: 500, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ─── BLE ─────────────────────────────────────────
  // Called once inside the "Start CoDriver" button tap (user gesture required)
  const connectBLE = async () => {
    if (!navigator.bluetooth) {
      console.warn("Web Bluetooth not supported on this browser");
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "CoDriver" }],
        optionalServices: [BLE_SERVICE_UUID],
      });
      bleDeviceRef.current = device;

      device.addEventListener("gattserverdisconnected", () => {
        setConnected(false);
        // Auto-reconnect after 2s
        setTimeout(() => reconnectBLE(), 2000);
      });

      await connectGATT(device);
    } catch (e) {
      console.warn("BLE connect error:", e.message);
    }
  };

  const connectGATT = async (device) => {
    try {
      const server  = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const char    = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);
      bleCharRef.current = char;

      await char.startNotifications();
      char.addEventListener("characteristicvaluechanged", handleBLEData);
      setConnected(true);
      console.log("✅ BLE connected to CoDriver");
    } catch (e) {
      console.warn("GATT connect error:", e.message);
      setConnected(false);
    }
  };

  const reconnectBLE = async () => {
    const device = bleDeviceRef.current;
    if (!device) return;
    try {
      await connectGATT(device);
    } catch {
      setTimeout(() => reconnectBLE(), 3000);
    }
  };

  const handleBLEData = (e) => {
    try {
      const raw  = new TextDecoder().decode(e.target.value);
      const data = JSON.parse(raw);
      const ax = parseFloat(data.accelX) || 0;
      const ay = parseFloat(data.accelY) || 0;
      const az = parseFloat(data.accelZ) || 0;
      const gForce = parseFloat(Math.sqrt(ax*ax + ay*ay + az*az).toFixed(2));
      const hb  = parseInt(data.hardBrakes) || 0;
      const st  = parseInt(data.sharpTurns) || 0;
      const ha  = parseInt(data.hardAccels) || 0;
      const evt = data.event || "normal";
      setHardBrakes(hb); setSharpTurns(st); setHardAccels(ha); setCurrentGForce(gForce);
      live.current.hardBrakes  = hb;
      live.current.sharpTurns  = st;
      live.current.hardAccels  = ha;
      live.current.gForce      = gForce;
      live.current.currentEvent = evt;
      setSensorData({
        event: evt, accelX: ax, accelY: ay, accelZ: az,
        gyroX: parseFloat(data.gyroX)||0, gyroY: parseFloat(data.gyroY)||0,
        gyroZ: parseFloat(data.gyroZ)||0, hardBrakes: hb, sharpTurns: st,
        hardAccels: ha, gForce, audioLevel: parseFloat(data.audioLevel)||0
      });
    } catch {}
  };

  // ─── Voice Recognition ────────────────────────────
  // Runs continuously but only acts on speech if:
  //   - listenMode is "active" (10s window after Nina / after AI speaks), OR
  //   - the transcript contains the wake word "nina"
  useEffect(() => {
    if (!audioStarted) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = false;
    rec.lang            = "en-US";

    rec.onstart = () => {};
    rec.onend   = () => {
      // Always restart — we need it running to catch the wake word
      if (!live.current.aiSpeaking) {
        setTimeout(() => { try { rec.start(); } catch {} }, 300);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") return;
      setTimeout(() => { try { rec.start(); } catch {} }, 1500);
    };

    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (!text || text.length < 2) return;
      if (!live.current.tripStarted) return;

      const lower = text.toLowerCase();
      const hasWakeWord = lower.includes(WAKE_WORD);

      if (live.current.listenMode === "active") {
        // Active window — send everything to the AI
        // Strip the wake word if it leads the sentence (e.g. "Nina how fast am I going")
        const cleaned = hasWakeWord
          ? text.replace(new RegExp(WAKE_WORD, "gi"), "").trim()
          : text;
        if (cleaned.length > 1) {
          closeListenWindow();
          handleDriverSpoke(cleaned);
        }
      } else {
        // Wake mode — only act if Nina is in the transcript
        if (hasWakeWord) {
          const cleaned = text.replace(new RegExp(WAKE_WORD, "gi"), "").trim();
          if (cleaned.length > 1) {
            // Wake word + question in one breath — send immediately
            closeListenWindow();
            handleDriverSpoke(cleaned);
          } else {
            // Just "Nina" — open the listen window and wait
            openListenWindow();
          }
        }
        // Anything else in wake mode is ignored silently
      }
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
    clearTimeout(wakeWindowRef.current);
  }, []);

  // ─── Main Analysis Loop ───────────────────────────
  // Proactive + event-driven calls are completely unaffected by wake word
  useEffect(() => {
    if (!audioStarted) return;
    const interval = setInterval(() => {
      if (!live.current.tripStarted) return;
      const now = Date.now();
      const l   = live.current;
      if (l.aiSpeaking) return;

      if (l.speed > l.limit + 5 && now - lastSpeedWarnRef.current > SPEED_WARN_MS) {
        lastSpeedWarnRef.current = now; callAnalyze("speeding"); return;
      }
      if (l.currentEvent && l.currentEvent !== "normal" && now - lastEventRef.current > EVENT_COOL_MS) {
        lastEventRef.current = now; callAnalyze(l.currentEvent); return;
      }
      if ((l.emotion === "sleeping" || l.emotion === "sad") && now - lastEmotionRef.current > EMOTION_COOL_MS) {
        lastEmotionRef.current = now; callAnalyze(l.emotion); return;
      }
      if (now - lastProactiveRef.current > PROACTIVE_MS) {
        lastProactiveRef.current = now; callAnalyze("proactive");
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [audioStarted]);

  // ─── Core Functions ───────────────────────────────
  const callAnalyze = async (trigger, driverMessage = "") => {
    if (live.current.aiSpeaking) return;
    const l = live.current;
    try {
      const res = await axios.post(`${BACKEND}/api/analyze`, {
        trigger,
        sensorData: { event: l.currentEvent, hardBrakes: l.hardBrakes,
          sharpTurns: l.sharpTurns, hardAccels: l.hardAccels, gForce: l.gForce },
        emotion: l.emotion, gps: l.gps, speedKmh: l.speed, driverMessage,
        tripStats: { tripSecs: Math.round((Date.now() - tripStartTimeRef.current) / 1000) }
      });
      const { reply, audio, speedLimit: sl } = res.data;
      if (sl && sl > 0) setSpeedLimit(Math.round(sl * 1.60934));
      addMessage("CoDriver", reply, trigger);
      if (audio) playAudio(audio);
    } catch (e) {
      console.error("Analyze error:", e.message);
    }
  };

  const handleDriverSpoke = (text) => {
    if (!live.current.tripStarted) return;
    const musicKw = ["play music", "play some music", "put on music", "play song", "play spotify", "play youtube"];
    if (musicKw.some(k => text.toLowerCase().includes(k))) { handleMusicRequest(text); return; }
    addMessage("You", text, "driver");
    callAnalyze("driver_spoke", text);
  };

  const handleMusicRequest = async (query) => {
    addMessage("You", query, "driver");
    try {
      const encoded = query.replace(/ /g, "+");
      setMusicData({ youtubeUrl: `https://www.youtube.com/results?search_query=${encoded}`,
        spotifyUrl: `https://open.spotify.com/search/${encoded}`, query });
      setMusicModal(true);
      addMessage("CoDriver", "Opening music for you!", "music");
    } catch { callAnalyze("driver_spoke", query); }
  };

  const addMessage = (sender, text, type = "normal") => {
    setConversation(prev => [
      ...prev.slice(-40),
      { sender, text, type, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
    ]);
  };

  const startTrip = async () => {
    tripStartTimeRef.current = Date.now();
    lastProactiveRef.current = Date.now();
    setTripStarted(true);
    live.current.tripStarted = true;
    setConversation([]);
    try { await axios.post(`${BACKEND}/api/trip-start`); } catch {}
    setTimeout(() => callAnalyze("proactive"), 1500);
  };

  const endTrip = async () => {
    if (tripEnded) return;
    setTripEnded(true);
    setTripStarted(false);
    live.current.tripStarted = false;
    clearTimeout(wakeWindowRef.current);
    setListenMode("wake");
    live.current.listenMode = "wake";
    try {
      const duration = Math.round((Date.now() - tripStartTimeRef.current) / 1000);
      const res = await axios.post(`${BACKEND}/api/trip-end`, {
        tripStats: { tripSecs: duration },
        maxSpeed, hardBrakes: live.current.hardBrakes,
        sharpTurns: live.current.sharpTurns,
        hardAccels: live.current.hardAccels,
      });
      setTripSummary(res.data);
      if (res.data.audio) playAudio(res.data.audio);
    } catch {}
  };

  const triggerCrash = async () => {
    if (crashTimerRef.current) return;
    navigator.vibrate?.([300, 100, 300, 100, 300]);
    setCrashAlert(true);
    try {
      const res = await axios.post(`${BACKEND}/api/crash`,
        { gps: live.current.gps, sensorData: { gForce: live.current.gForce } });
      setCrashData(res.data);
      if (res.data.audio) playAudio(res.data.audio);
    } catch {}
    crashTimerRef.current = setTimeout(() => { window.location.href = "tel:911"; }, 5000);
  };

  const dismissCrash = () => {
    setCrashAlert(false); setCrashData(null);
    clearTimeout(crashTimerRef.current); crashTimerRef.current = null;
  };

  // ─── Start Screen ─────────────────────────────────
  if (!audioStarted) {
    const features = [
      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>, label: 'Say "Nina" to talk' },
      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>, label: 'Reads hardware sensors' },
      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>, label: 'Powered by Gemini 2.5' },
      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, label: 'Emergency crash detection' },
    ];
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--charcoal)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', maxWidth: 420, margin: '0 auto',
      }}>
        {/* Logo mark */}
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'var(--red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 40px var(--red-glow)',
          marginBottom: 28,
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M12 12l9-5M12 12v10M12 12L3 7" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 42, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8, letterSpacing: '-2px', textAlign: 'center' }}>
          Co<span style={{ color: 'var(--red)' }}>Driver</span>
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 16, marginBottom: 36, textAlign: 'center' }}>
          Your AI co-pilot
        </p>

        {/* Features */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '12px 16px',
              color: 'var(--text-2)',
            }}>
              <div style={{ color: 'var(--red)', flexShrink: 0 }}>{f.icon}</div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{f.label}</span>
            </div>
          ))}
        </div>

        <button onClick={unlockAudio} className="btn-red" style={{
          width: '100%', padding: '18px', fontSize: 17,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start CoDriver
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14, textAlign: 'center', letterSpacing: '0.3px' }}>
          TAP TO ENABLE VOICE & AUDIO
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--charcoal)', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {crashAlert  && <CrashAlert crashData={crashData} onDismiss={dismissCrash} />}
      {tripSummary && <TripSummary summary={tripSummary} onClose={() => { setTripSummary(null); setTripEnded(false); }} />}
      {musicModal  && musicData && <MusicModal data={musicData} onClose={() => setMusicModal(false)} />}

      <Header connected={connected} aiSpeaking={aiSpeaking} micVolume={micVolume} listenMode={listenMode} tripStarted={tripStarted} />

      <div style={{ padding: '12px 14px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SpeedCard speedKmh={speedKmh} speedLimit={speedLimit} sensorData={sensorData} />
        <StatsRow hardBrakes={hardBrakes} sharpTurns={sharpTurns} hardAccels={hardAccels}
          currentGForce={currentGForce} tripStartTime={tripStartTimeRef.current} />
        <DriverStatus emotion={emotion} setEmotion={setEmotion} gps={gps} />

        {/* Connect sensor */}
        {!connected && (
          <button onClick={connectBLE} className="btn-dark" style={{
            width: '100%', padding: '13px', fontSize: 13,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Connect Sensor
          </button>
        )}

        {/* Trip button */}
        {!tripStarted ? (
          <button onClick={startTrip} className="btn-red" style={{
            width: '100%', padding: '16px', fontSize: 16,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Start Trip
          </button>
        ) : (
          <button onClick={endTrip} className="btn-dark" style={{
            width: '100%', padding: '16px', fontSize: 16,
            border: '1px solid var(--border-2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
            End Trip
          </button>
        )}

        {!tripStarted && !tripEnded && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', letterSpacing: '0.3px' }}>
            TAP TO BEGIN — CODRIVER WILL GREET YOU
          </p>
        )}

        <ConversationPanel conversation={conversation} aiSpeaking={aiSpeaking}
          listenMode={listenMode} micVolume={micVolume} tripStarted={tripStarted} />
      </div>
    </div>
  );
}
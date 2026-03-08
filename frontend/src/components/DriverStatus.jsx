import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const EMOTION_CONFIG = {
  neutral:  { emoji: "😐", label: "Focused",  color: "text-gray-600",  bg: "bg-gray-100" },
  happy:    { emoji: "😊", label: "Happy",    color: "text-green-600", bg: "bg-green-50" },
  tired:    { emoji: "😴", label: "Tired",    color: "text-orange-600", bg: "bg-orange-50" },
  stressed: { emoji: "😰", label: "Stressed", color: "text-red-600",   bg: "bg-red-50" },
};

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";
const SCAN_INTERVAL_MS = 30000; // scan every 30s — conservative API usage

export default function DriverStatus({ emotion, setEmotion, gps }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);

  const [camReady,   setCamReady]   = useState(false);
  const [scanning,   setScanning]   = useState(false);
  const [lastScan,   setLastScan]   = useState(null); // time of last scan
  const [countdown,  setCountdown]  = useState(null); // seconds until next scan

  const cfg = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;

  // ─── Camera init ──────────────────────────────
  useEffect(() => {
    let stream;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }
      } catch (e) {
        console.warn("Camera error:", e.message);
      }
    }
    startCamera();
    return () => {
      clearInterval(intervalRef.current);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ─── Countdown timer (UI only) ────────────────
  useEffect(() => {
    if (!camReady) return;
    // First scan after 3s
    const firstScan = setTimeout(() => analyzeEmotion(), 3000);
    // Then every 30s
    intervalRef.current = setInterval(() => analyzeEmotion(), SCAN_INTERVAL_MS);

    // Countdown display — updates every second
    let nextScanAt = Date.now() + 3000;
    const countdownTick = setInterval(() => {
      const secs = Math.max(0, Math.round((nextScanAt - Date.now()) / 1000));
      setCountdown(secs);
      if (secs === 0) nextScanAt = Date.now() + SCAN_INTERVAL_MS;
    }, 1000);

    return () => {
      clearTimeout(firstScan);
      clearInterval(intervalRef.current);
      clearInterval(countdownTick);
    };
  }, [camReady]);

  // ─── Capture frame → base64 JPEG ──────────────
  const captureFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width  = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    // Mirror flip so it matches what user sees
    ctx.translate(320, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, 320, 240);
    // Return base64 without data URL prefix
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  };

  // ─── Call backend /api/emotion ────────────────
  const analyzeEmotion = async () => {
    if (scanning) return;
    const frame = captureFrame();
    if (!frame) return;

    setScanning(true);
    try {
      const res = await fetch(`${BACKEND}/api/emotion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frame }),
      });
      const data = await res.json();
      if (data.emotion) {
        setEmotion(data.emotion);
        setLastScan(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (e) {
      console.warn("Emotion scan error:", e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="p-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-600 text-gray-700">Driver Status</span>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${cfg.bg}`}>
            <span className="text-sm">{cfg.emoji}</span>
            <span className={`text-xs font-600 ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        {/* Camera */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-100" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <canvas ref={canvasRef} className="hidden" />

          {!camReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="text-3xl mb-2">📷</div>
                <p className="text-xs text-gray-400">Starting camera...</p>
              </div>
            </div>
          )}

          {/* Status badge */}
          {camReady && (
            <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-600 ${
              scanning
                ? "bg-yellow-500 text-white"
                : "bg-black bg-opacity-50 text-white"
            }`}>
              {scanning
                ? "● Scanning..."
                : lastScan
                  ? `✓ ${lastScan}`
                  : countdown !== null
                    ? `Next scan in ${countdown}s`
                    : "● AI Vision"}
            </div>
          )}

          {/* Alert overlay */}
          {(emotion === "tired" || emotion === "stressed") && (
            <div className={`absolute bottom-0 left-0 right-0 py-2 px-3 ${
              emotion === "stressed" ? "bg-red-600" : "bg-orange-500"
            } bg-opacity-90`}>
              <p className="text-white text-xs font-600 text-center">
                {emotion === "tired"
                  ? "😴 Fatigue detected — consider a break"
                  : "😰 Stress detected — take a breath"}
              </p>
            </div>
          )}
        </div>

        {/* GPS */}
        {gps.lat && (
          <div className="flex items-center gap-2 mt-3 px-1">
            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 truncate">
              {gps.lat.toFixed(4)}°, {gps.lng.toFixed(4)}°
            </span>
            <a
              href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-[10px] text-red-500 font-500 flex-shrink-0"
            >
              Maps →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
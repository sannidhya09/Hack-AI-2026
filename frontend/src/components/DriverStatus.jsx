import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const EMOTION_CONFIG = {
  neutral:  { emoji: "😐", label: "Focused",  color: "text-gray-600",  bg: "bg-gray-100" },
  happy:    { emoji: "😊", label: "Happy",     color: "text-green-600", bg: "bg-green-50" },
  sad:      { emoji: "😔", label: "Sad",       color: "text-blue-600",  bg: "bg-blue-50" },
  sleeping: { emoji: "😴", label: "Drowsy",    color: "text-red-600",   bg: "bg-red-50" },
};

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";
const SCAN_INTERVAL_MS = 60000; // every 60s — keeps it completely out of AI response path

export default function DriverStatus({ emotion, setEmotion, gps }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);
  const scanningRef = useRef(false); // use ref not state to avoid re-render blocking

  const [camReady,  setCamReady]  = useState(false);
  const [scanning,  setScanning]  = useState(false);
  const [lastScan,  setLastScan]  = useState(null);

  const cfg = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;

  // ─── Camera init ──────────────────────────────
  useEffect(() => {
    let stream;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Higher resolution so Gemini can actually read facial features
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        // Wait for video to be genuinely ready — not just srcObject assigned
        video.onloadeddata = () => setCamReady(true);
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

  // ─── Scan loop — starts only when camera is genuinely ready ───
  useEffect(() => {
    if (!camReady) return;
    // First scan after 5s to let camera warm up and exposure settle
    const firstScan = setTimeout(() => analyzeEmotion(), 5000);
    intervalRef.current = setInterval(() => analyzeEmotion(), SCAN_INTERVAL_MS);
    return () => {
      clearTimeout(firstScan);
      clearInterval(intervalRef.current);
    };
  }, [camReady]);

  // ─── Capture frame ────────────────────────────
  const captureFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    // readyState 4 = HAVE_ENOUGH_DATA — video is fully rendering
    if (!video || !canvas || video.readyState < 4) return null;

    const W = video.videoWidth  || 640;
    const H = video.videoHeight || 480;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    // CRITICAL: reset transform before every draw — otherwise transforms accumulate
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Draw video normally (no mirror — Gemini doesn't need it mirrored)
    ctx.drawImage(video, 0, 0, W, H);

    // JPEG at 0.85 quality — better than 0.7 for face detection accuracy
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  };

  // ─── Emotion scan — one frame, one call, skip if unclear ────
  const analyzeEmotion = async () => {
    if (scanningRef.current) return;
    const frame = captureFrame();
    if (!frame) return;

    scanningRef.current = true;
    setScanning(true);
    try {
      const res = await fetch(`${BACKEND}/api/emotion`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: frame }),
      });
      const data = await res.json();
      if (data.emotion) {
        setEmotion(data.emotion);
        setLastScan(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
      // data.skipped = true means face was unclear — keep previous emotion silently
    } catch (e) {
      console.warn("Emotion scan error:", e.message);
    } finally {
      scanningRef.current = false;
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
              scanning ? "bg-yellow-500 text-white" : "bg-black bg-opacity-50 text-white"
            }`}>
              {scanning ? "● Scanning..." : lastScan ? `✓ ${lastScan}` : "● AI Vision"}
            </div>
          )}

          {/* Drowsy alert */}
          {emotion === "sleeping" && (
            <div className="absolute bottom-0 left-0 right-0 py-2 px-3 bg-red-600 bg-opacity-90">
              <p className="text-white text-xs font-600 text-center">
                😴 Drowsiness detected — please stay alert!
              </p>
            </div>
          )}
          {emotion === "sad" && (
            <div className="absolute bottom-0 left-0 right-0 py-2 px-3 bg-blue-600 bg-opacity-90">
              <p className="text-white text-xs font-600 text-center">
                😔 You seem down — CoDriver is here with you
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
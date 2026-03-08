import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const EMOTION_CONFIG = {
  neutral:  { emoji: "😐", label: "Focused",  color: "text-gray-600",  bg: "bg-gray-100" },
  happy:    { emoji: "😊", label: "Happy",    color: "text-green-600", bg: "bg-green-50" },
  tired:    { emoji: "😴", label: "Tired",    color: "text-red-600",   bg: "bg-red-50" },
  stressed: { emoji: "😰", label: "Stressed", color: "text-red-600",   bg: "bg-red-50" },
};

export default function DriverStatus({ emotion, setEmotion, gps }) {
  const videoRef  = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [presageReady, setPresageReady] = useState(false);
  const presageKey = import.meta.env.VITE_PRESAGE_API_KEY;

  const cfg = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;

  // ─── Camera + Presage ──────────────────────────
  useEffect(() => {
    let interval;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }

        // Presage SDK
        if (window.Presage && presageKey) {
          try {
            await window.Presage.init({ apiKey: presageKey });
            setPresageReady(true);

            interval = setInterval(async () => {
              if (!videoRef.current) return;
              try {
                const result = await window.Presage.analyze(videoRef.current);
                if (!result) return;

                const engagement = result.engagement ?? 1;
                const valence    = result.valence ?? 0;
                const arousal    = result.arousal ?? 0;

                if (engagement < 0.25 || arousal < -0.4) {
                  setEmotion("tired");
                } else if (valence < -0.25 && arousal > 0.1) {
                  setEmotion("stressed");
                } else if (valence > 0.3 && engagement > 0.5) {
                  setEmotion("happy");
                } else {
                  setEmotion("neutral");
                }
              } catch {}
            }, 5000);

          } catch (e) {
            console.log("Presage init:", e.message);
          }
        }
      } catch (e) {
        console.log("Camera:", e.message);
      }
    }

    initCamera();

    return () => {
      clearInterval(interval);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="p-4">

        {/* Status Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-600 text-gray-700">Driver Status</span>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${cfg.bg}`}>
            <span className="text-sm">{cfg.emoji}</span>
            <span className={`text-xs font-600 ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        {/* Camera Feed */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />

          {!camReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="text-3xl mb-2">📷</div>
                <p className="text-xs text-gray-400">Starting camera...</p>
              </div>
            </div>
          )}

          {/* Presage indicator */}
          {camReady && (
            <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-600 ${
              presageReady
                ? 'bg-green-500 text-white'
                : 'bg-black bg-opacity-50 text-gray-300'
            }`}>
              {presageReady ? '● Presage Live' : '○ Camera Ready'}
            </div>
          )}

          {/* Emotion overlay when tired/stressed */}
          {(emotion === "tired" || emotion === "stressed") && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-600 bg-opacity-90 py-2 px-3">
              <p className="text-white text-xs font-600 text-center">
                {emotion === "tired" ? "😴 Fatigue detected — consider a break" : "😰 Stress detected"}
              </p>
            </div>
          )}
        </div>

        {/* GPS Location */}
        {gps.lat && (
          <div className="flex items-center gap-2 mt-3 px-1">
            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 font-400 truncate">
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

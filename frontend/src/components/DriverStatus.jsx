import { useEffect, useRef, useState } from "react";

const EMOTION_CONFIG = {
  neutral:  { label: "Focused",  color: 'var(--text-2)',  bg: 'var(--surface-2)',  border: 'var(--border)' },
  happy:    { label: "Happy",    color: 'var(--green)',   bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)' },
  sad:      { label: "Sad",      color: '#60A5FA',        bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
  sleeping: { label: "Drowsy",   color: 'var(--red)',     bg: 'rgba(232,50,26,0.08)', border: 'rgba(232,50,26,0.2)' },
};

function EmotionIcon({ emotion }) {
  const c = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;
  if (emotion === 'happy') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
    </svg>
  );
  if (emotion === 'sad') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/>
    </svg>
  );
  if (emotion === 'sleeping') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2">
      <path d="M17 7l-5 5-5-5M17 12l-5 5-5-5"/>
    </svg>
  );
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/>
    </svg>
  );
}

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";
const SCAN_INTERVAL_MS = 60000;

export default function DriverStatus({ emotion, setEmotion, gps }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);
  const scanningRef = useRef(false);

  const [camReady,  setCamReady]  = useState(false);
  const [scanning,  setScanning]  = useState(false);
  const [lastScan,  setLastScan]  = useState(null);

  const cfg = EMOTION_CONFIG[emotion] || EMOTION_CONFIG.neutral;

  useEffect(() => {
    let stream;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.onloadeddata = () => setCamReady(true);
      } catch (e) { console.warn("Camera error:", e.message); }
    }
    startCamera();
    return () => { clearInterval(intervalRef.current); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    if (!camReady) return;
    const first = setTimeout(() => analyzeEmotion(), 5000);
    intervalRef.current = setInterval(() => analyzeEmotion(), SCAN_INTERVAL_MS);
    return () => { clearTimeout(first); clearInterval(intervalRef.current); };
  }, [camReady]);

  const captureFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 4) return null;
    const W = video.videoWidth || 640;
    const H = video.videoHeight || 480;
    canvas.width  = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(video, 0, 0, W, H);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  };

  const analyzeEmotion = async () => {
    if (scanningRef.current) return;
    const frame = captureFrame();
    if (!frame) return;
    scanningRef.current = true;
    setScanning(true);
    try {
      const res  = await fetch(`${BACKEND}/api/emotion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frame }),
      });
      const data = await res.json();
      if (data.emotion) {
        setEmotion(data.emotion);
        setLastScan(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (e) { console.warn("Emotion scan error:", e.message); }
    finally { scanningRef.current = false; setScanning(false); }
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Driver Status</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 20, padding: '4px 10px',
            transition: 'all 0.3s ease',
          }}>
            <EmotionIcon emotion={emotion} />
            <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, letterSpacing: '0.3px' }}>{cfg.label}</span>
          </div>
        </div>

        {/* Camera */}
        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          background: 'var(--surface-2)', aspectRatio: '4/3',
        }}>
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {!camReady && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-2)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" style={{ margin: '0 auto 8px' }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Starting camera...</p>
              </div>
            </div>
          )}

          {/* Scan badge */}
          {camReady && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: scanning ? 'rgba(245,158,11,0.9)' : 'rgba(15,15,15,0.7)',
              borderRadius: 8, padding: '3px 8px',
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', letterSpacing: '0.4px' }}>
                {scanning ? 'SCANNING' : lastScan ? `SCANNED ${lastScan}` : 'AI VISION'}
              </span>
            </div>
          )}

          {/* Alert overlays */}
          {emotion === 'sleeping' && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(0deg, rgba(232,50,26,0.95), rgba(232,50,26,0.7))',
              padding: '8px 12px',
            }}>
              <p style={{ color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', letterSpacing: '0.3px' }}>
                DROWSINESS DETECTED — STAY ALERT
              </p>
            </div>
          )}
          {emotion === 'sad' && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(0deg, rgba(96,165,250,0.85), rgba(96,165,250,0.6))',
              padding: '8px 12px',
            }}>
              <p style={{ color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', letterSpacing: '0.3px' }}>
                CODRIVER IS WITH YOU
              </p>
            </div>
          )}
        </div>

        {/* GPS */}
        {gps.lat && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--text-3)', flex: 1 }}>
              {gps.lat.toFixed(4)}°, {gps.lng.toFixed(4)}°
            </span>
            <a href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 10, color: 'var(--red)', fontWeight: 500 }}>
              Maps →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
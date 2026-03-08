import { useState, useEffect } from "react";

export default function CrashAlert({ crashData, onDismiss }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const i = setInterval(() => setCountdown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(i);
  }, []);

  const circ = 2 * Math.PI * 26;

  return (
    <div className="crash-bg" style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      {/* Pulse ring */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <div style={{
          position: 'absolute', inset: -20,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
        }} className="animate-ping" />
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
      </div>

      <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-1px', textAlign: 'center' }}>
        CRASH DETECTED
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, marginBottom: 6, textAlign: 'center' }}>
        Calling 911 in <strong style={{ color: '#fff', fontSize: 24 }}>{countdown}</strong> seconds
      </p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 36, textAlign: 'center' }}>
        Dismiss if you are okay
      </p>

      {/* Countdown ring */}
      <svg width="56" height="56" viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)', marginBottom: 32 }}>
        <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4"/>
        <circle cx="30" cy="30" r="26" fill="none" stroke="white" strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - countdown / 5)}
          style={{ transition: 'stroke-dashoffset 1s linear' }} strokeLinecap="round"/>
      </svg>

      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="tel:911" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: '#fff', color: 'var(--red)', fontWeight: 700,
          padding: '16px', borderRadius: 16, fontSize: 16,
          textDecoration: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.36 2 2 0 0 1 3.62 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16z"/>
          </svg>
          Call 911 Now
        </a>

        {crashData?.mapsUrl && (
          <a href={crashData.mapsUrl} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600,
            padding: '14px', borderRadius: 16, fontSize: 14,
            textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            Share My Location
          </a>
        )}

        <button onClick={onDismiss} style={{
          background: 'transparent', color: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 500,
          cursor: 'pointer',
        }}>
          I'm okay — Dismiss
        </button>
      </div>
    </div>
  );
}
import { CheckCircle, X } from "lucide-react";
import WaveformBar from "./WaveformBar";

export default function TripSummary({ summary, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
    }}>
      <div className="animate-slide-up" style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)', borderRadius: 24,
        border: '1px solid var(--border-2)', overflow: 'hidden',
        boxShadow: '0 -8px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--red-deep), var(--red))',
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={18} color="white" />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Trip Complete</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>AI Summary</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: '50%', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <X size={16} color="white" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{
            background: 'rgba(232,50,26,0.06)',
            border: '1px solid rgba(232,50,26,0.12)',
            borderRadius: 16, padding: '14px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, flexShrink: 0,
                background: 'var(--red)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px var(--red-glow)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 2L3 7v10l9 5 9-5V7L12 2z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, margin: 0 }}>
                  {summary.summary}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <WaveformBar active={true} color="red" bars={8} height={12} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.3px' }}>Playing summary...</span>
            </div>
          </div>

          <button onClick={onClose} className="btn-red" style={{
            width: '100%', padding: '14px', fontSize: 15,
            border: 'none', cursor: 'pointer',
          }}>
            Start New Trip
          </button>
        </div>
      </div>
    </div>
  );
}
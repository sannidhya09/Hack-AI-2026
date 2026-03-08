import WaveformBar from "./WaveformBar";

export default function Header({ connected, aiSpeaking, micVolume, listenMode, tripStarted }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(15,15,15,0.92)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--red)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px var(--red-glow)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 12l9-5M12 12v10M12 12L3 7" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1, letterSpacing: '-0.5px' }}>
              Co<span style={{ color: 'var(--red)' }}>Driver</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>AI Co-Pilot</div>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Speaking */}
          {aiSpeaking && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(232,50,26,0.12)',
              border: '1px solid rgba(232,50,26,0.25)',
              borderRadius: 20, padding: '5px 10px',
            }}>
              <WaveformBar active={true} color="red" bars={8} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', letterSpacing: '0.3px' }}>SPEAKING</span>
            </div>
          )}

          {/* Mic state */}
          {!aiSpeaking && tripStarted && (
            listenMode === 'active' ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 20, padding: '5px 10px',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} className="animate-pulse" />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', letterSpacing: '0.3px' }}>LISTENING</span>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 20, padding: '5px 10px',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                </svg>
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.3px' }}>SAY NINA</span>
              </div>
            )
          )}

          {/* Hardware */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: connected ? 'rgba(34,197,94,0.08)' : 'var(--surface-2)',
            border: `1px solid ${connected ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
            borderRadius: 20, padding: '5px 10px',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connected ? 'var(--green)' : 'var(--text-3)',
            }} />
            <span style={{
              fontSize: 10, fontWeight: 500, letterSpacing: '0.3px',
              color: connected ? 'var(--green)' : 'var(--text-3)',
            }}>
              {connected ? 'HARDWARE' : 'NO SENSOR'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
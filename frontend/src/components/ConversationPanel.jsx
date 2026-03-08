import WaveformBar from "./WaveformBar";

export default function ConversationPanel({ conversation, aiSpeaking, listenMode, micVolume, tripStarted }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          Conversation
        </span>

        {tripStarted && (
          aiSpeaking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <WaveformBar active={true} color="red" bars={10} height={14} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', letterSpacing: '0.3px' }}>NINA SPEAKING</span>
            </div>
          ) : listenMode === 'active' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} className="animate-pulse" />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', letterSpacing: '0.3px' }}>LISTENING</span>
            </div>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.3px' }}>SAY "NINA" TO TALK</span>
          )
        )}
      </div>

      {/* Messages */}
      <div style={{ padding: '12px 14px', maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {conversation.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 44, height: 44,
              background: 'var(--surface-2)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
              border: '1px solid var(--border)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
              </svg>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
              {tripStarted ? 'Waiting for your voice...' : 'Start a trip to begin'}
            </p>
            {tripStarted && (
              <p style={{ fontSize: 10, color: 'var(--text-3)', opacity: 0.6 }}>
                Say "Nina" then speak · Safety alerts are always on
              </p>
            )}
          </div>
        ) : (
          conversation.map((msg, i) => (
            <div key={i} className="animate-fade-in" style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 26, height: 26, flexShrink: 0,
                  background: 'var(--red)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 8, alignSelf: 'flex-end',
                  boxShadow: '0 2px 8px var(--red-glow)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 2L3 7v10l9 5 9-5V7L12 2z"/>
                  </svg>
                </div>
              )}
              <div style={{
                maxWidth: '78%',
                background: msg.role === 'user' ? 'var(--surface-3)' : 'rgba(232,50,26,0.08)',
                border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'rgba(232,50,26,0.15)'}`,
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '9px 13px',
              }}>
                <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5, margin: 0 }}>{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
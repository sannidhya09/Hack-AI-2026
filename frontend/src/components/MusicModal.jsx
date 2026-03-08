import { Music, X, ExternalLink } from "lucide-react";

export default function MusicModal({ data, onClose }) {
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
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--surface-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-2)',
            }}>
              <Music size={16} color="var(--text-2)" />
            </div>
            <div>
              <div style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 15 }}>Music Search</div>
              <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 1 }}>"{data.query}"</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--surface-3)', border: '1px solid var(--border)',
            borderRadius: '50%', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        {/* Options */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={data.youtubeUrl} target="_blank" rel="noreferrer" onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(232,50,26,0.06)', border: '1px solid rgba(232,50,26,0.15)',
            borderRadius: 16, padding: '14px', textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'var(--red)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 12px var(--red-glow)',
            }}>
              {/* YouTube play icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 14 }}>YouTube</div>
              <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>Search "{data.query}"</div>
            </div>
            <ExternalLink size={13} color="var(--text-3)" />
          </a>

          <a href={data.spotifyUrl} target="_blank" rel="noreferrer" onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(30,215,96,0.06)', border: '1px solid rgba(30,215,96,0.15)',
            borderRadius: 16, padding: '14px', textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: '#1DB954', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 12px rgba(30,215,96,0.3)',
            }}>
              {/* Spotify icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 14 }}>Spotify</div>
              <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>Search "{data.query}"</div>
            </div>
            <ExternalLink size={13} color="var(--text-3)" />
          </a>

          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-3)', fontSize: 13, fontWeight: 500,
            padding: '10px', cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";

const EVENT_CONFIG = {
  hard_brake:        { label: "Hard Brake",        color: '#E8321A', icon: 'brake' },
  hard_acceleration: { label: "Hard Acceleration", color: '#F59E0B', icon: 'accel' },
  sharp_turn_right:  { label: "Sharp Turn Right",  color: '#F59E0B', icon: 'turn' },
  sharp_turn_left:   { label: "Sharp Turn Left",   color: '#F59E0B', icon: 'turn' },
  swerve:            { label: "Swerving",           color: '#E8321A', icon: 'swerve' },
};

function EventIcon({ type }) {
  if (type === 'brake') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>
    </svg>
  );
  if (type === 'accel') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 12h18M15 6l6 6-6 6"/>
    </svg>
  );
}

export default function SpeedCard({ speedKmh, speedLimit, sensorData }) {
  const [showEvent, setShowEvent] = useState(false);

  const speedMph      = Math.round(speedKmh / 1.60934);
  const speedLimitMph = Math.round(speedLimit / 1.60934);
  const isSpeeding    = speedKmh > speedLimit + 2;
  const overage       = Math.max(0, speedMph - speedLimitMph);
  const fillPct       = Math.min(100, (speedMph / Math.max(1, speedLimitMph * 1.4)) * 100);

  const event     = sensorData?.event;
  const eventConf = event ? EVENT_CONFIG[event] : null;

  useEffect(() => {
    if (eventConf) {
      setShowEvent(true);
      const t = setTimeout(() => setShowEvent(false), 3000);
      return () => clearTimeout(t);
    }
  }, [event]);

  return (
    <div className="card" style={{ padding: '20px', overflow: 'hidden', position: 'relative' }}>

      {/* Subtle red glow when speeding */}
      {isSpeeding && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(232,50,26,0.08) 0%, transparent 70%)',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>

        {/* Speed */}
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <span className={`num ${isSpeeding ? 'speed-over' : ''}`} style={{
              fontSize: 80, fontWeight: 500, lineHeight: 1,
              color: isSpeeding ? 'var(--red)' : 'var(--text-1)',
              letterSpacing: '-4px',
              transition: 'color 0.3s ease',
            }}>
              {speedMph}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)', marginBottom: 10 }}>mph</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.5px', marginTop: 2 }}>
            {speedMph === 0 ? 'STATIONARY' : isSpeeding ? `${overage} MPH OVER LIMIT` : 'WITHIN LIMIT'}
          </div>
        </div>

        {/* Speed limit badge */}
        <div style={{
          width: 64, height: 64,
          borderRadius: 16,
          background: isSpeeding ? 'var(--red)' : 'var(--surface-2)',
          border: `2px solid ${isSpeeding ? 'var(--red)' : 'var(--border-2)'}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: isSpeeding ? '0 4px 20px var(--red-glow)' : 'none',
          transition: 'all 0.3s ease',
        }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: isSpeeding ? 'rgba(255,255,255,0.6)' : 'var(--text-3)', letterSpacing: '0.5px' }}>LIMIT</span>
          <span className="num" style={{ fontSize: 22, fontWeight: 500, color: isSpeeding ? '#fff' : 'var(--text-1)', lineHeight: 1.1 }}>{speedLimitMph}</span>
          <span style={{ fontSize: 9, color: isSpeeding ? 'rgba(255,255,255,0.6)' : 'var(--text-3)' }}>mph</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, background: 'var(--surface-3)', borderRadius: 4,
        overflow: 'hidden', position: 'relative', marginBottom: 4,
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${fillPct}%`,
          background: isSpeeding
            ? 'linear-gradient(90deg, var(--red-deep), var(--red))'
            : 'linear-gradient(90deg, #16a34a, var(--green))',
          borderRadius: 4,
          transition: 'width 0.4s ease, background 0.3s ease',
        }} />
        {/* Limit marker */}
        <div style={{
          position: 'absolute', top: 0, height: '100%', width: 2,
          background: 'var(--text-3)', opacity: 0.4,
          left: `${(speedLimitMph / (speedLimitMph * 1.4)) * 100}%`,
        }} />
      </div>

      {/* Event toast */}
      {showEvent && eventConf && (
        <div className="animate-fade-in" style={{
          marginTop: 12,
          display: 'flex', alignItems: 'center', gap: 8,
          background: `${eventConf.color}15`,
          border: `1px solid ${eventConf.color}30`,
          borderRadius: 10, padding: '8px 12px',
          color: eventConf.color,
        }}>
          <EventIcon type={eventConf.icon} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{eventConf.label} detected</span>
        </div>
      )}
    </div>
  );
}
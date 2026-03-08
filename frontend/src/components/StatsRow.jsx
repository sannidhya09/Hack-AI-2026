import { useEffect, useState } from "react";

function StatCard({ label, value, unit, flash, children }) {
  return (
    <div style={{
      flex: 1,
      background: flash ? 'rgba(232,50,26,0.08)' : 'var(--surface)',
      border: `1px solid ${flash ? 'rgba(232,50,26,0.2)' : 'var(--border)'}`,
      borderRadius: 16, padding: '12px 10px',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ marginBottom: 6 }}>{children}</div>
      <div className="num" style={{
        fontSize: 24, fontWeight: 500, lineHeight: 1,
        color: flash ? 'var(--red)' : 'var(--text-1)',
        transition: 'color 0.2s ease',
      }}>
        {value}
        {unit && <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)', marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, fontWeight: 500, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

// Clean SVG icons — no emojis
function BrakeIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--red)' : 'var(--text-3)'} strokeWidth="2">
      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>
    </svg>
  );
}
function TurnIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--amber)' : 'var(--text-3)'} strokeWidth="2">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10l4 4-4 4H9m0-8v8"/>
    </svg>
  );
}
function GForceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  );
}
function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  );
}

export default function StatsRow({ hardBrakes, sharpTurns, hardAccels, currentGForce, tripStartTime }) {
  const [elapsed,    setElapsed]    = useState(0);
  const [prevBrakes, setPrevBrakes] = useState(0);
  const [prevTurns,  setPrevTurns]  = useState(0);
  const [brakeFlash, setBrakeFlash] = useState(false);
  const [turnFlash,  setTurnFlash]  = useState(false);

  useEffect(() => {
    const i = setInterval(() => setElapsed(Math.round((Date.now() - tripStartTime) / 1000)), 1000);
    return () => clearInterval(i);
  }, [tripStartTime]);

  useEffect(() => {
    if (hardBrakes > prevBrakes) { setBrakeFlash(true); setTimeout(() => setBrakeFlash(false), 1200); }
    setPrevBrakes(hardBrakes);
  }, [hardBrakes]);

  useEffect(() => {
    if (sharpTurns > prevTurns) { setTurnFlash(true); setTimeout(() => setTurnFlash(false), 1200); }
    setPrevTurns(sharpTurns);
  }, [sharpTurns]);

  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs.toString().padStart(2,'0')}s` : `${secs}s`;
  const gVal    = currentGForce > 0 ? currentGForce.toFixed(1) : '0.0';

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <StatCard label="Hard Brakes" value={hardBrakes} flash={brakeFlash}>
        <BrakeIcon active={brakeFlash} />
      </StatCard>
      <StatCard label="Sharp Turns" value={sharpTurns} flash={turnFlash}>
        <TurnIcon active={turnFlash} />
      </StatCard>
      <StatCard label="G-Force" value={gVal} unit="g">
        <GForceIcon />
      </StatCard>
      <StatCard label="Trip Time" value={timeStr}>
        <TimerIcon />
      </StatCard>
    </div>
  );
}
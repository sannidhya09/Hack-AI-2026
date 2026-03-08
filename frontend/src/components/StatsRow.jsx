import { useEffect, useState } from "react";

function StatCard({ label, value, unit, icon, alert }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (alert) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1000);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className={`stat-card flex-1 rounded-2xl p-3 border transition-all duration-200 ${
      flash
        ? 'bg-red-50 border-red-200'
        : 'bg-gray-50 border-gray-100'
    }`}>
      <div className="text-base mb-1">{icon}</div>
      <div className={`text-2xl font-800 leading-none ${
        flash ? 'text-red-600' : 'text-gray-800'
      }`}>
        {value}
        <span className="text-xs font-400 text-gray-400 ml-0.5">{unit}</span>
      </div>
      <div className="text-[10px] text-gray-400 mt-1 font-500 leading-tight">{label}</div>
    </div>
  );
}

export default function StatsRow({ sensorData, tripStartTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - tripStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [tripStartTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m` : `${secs}s`;

  const hardBrakes  = sensorData?.hardBrakes ?? 0;
  const sharpTurns  = sensorData?.sharpTurns ?? 0;
  const hardAccels  = sensorData?.hardAccels ?? 0;
  const accelMag    = Math.abs(sensorData?.accelY ?? 0).toFixed(1);

  return (
    <div className="flex gap-2">
      <StatCard
        label="Hard Brakes"
        value={hardBrakes}
        icon="🛑"
        alert={hardBrakes > 0}
      />
      <StatCard
        label="Sharp Turns"
        value={sharpTurns}
        icon="↩️"
        alert={sharpTurns > 2}
      />
      <StatCard
        label="G-Force"
        value={accelMag}
        unit="g"
        icon="📡"
      />
      <StatCard
        label="Trip Time"
        value={timeStr}
        icon="⏱️"
      />
    </div>
  );
}

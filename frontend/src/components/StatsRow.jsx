import { useEffect, useState } from "react";

function StatCard({ label, value, unit, icon, alert, flash: forceFlash }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (alert && forceFlash) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className={`flex-1 rounded-2xl p-3 border transition-all duration-200 ${
      flash ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'
    }`}>
      <div className="text-base mb-1">{icon}</div>
      <div className={`text-2xl font-800 leading-none ${flash ? 'text-red-600' : 'text-gray-800'}`}>
        {value}
        {unit && <span className="text-xs font-400 text-gray-400 ml-0.5">{unit}</span>}
      </div>
      <div className="text-[10px] text-gray-400 mt-1 font-500 leading-tight">{label}</div>
    </div>
  );
}

export default function StatsRow({ hardBrakes, sharpTurns, hardAccels, currentGForce, tripStartTime }) {
  const [elapsed, setElapsed] = useState(0);
  const [prevBrakes, setPrevBrakes] = useState(0);
  const [prevTurns, setPrevTurns]   = useState(0);
  const [brakeFlash, setBrakeFlash] = useState(false);
  const [turnFlash, setTurnFlash]   = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - tripStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [tripStartTime]);

  // Flash when new event detected
  useEffect(() => {
    if (hardBrakes > prevBrakes) {
      setBrakeFlash(true);
      setTimeout(() => setBrakeFlash(false), 1200);
    }
    setPrevBrakes(hardBrakes);
  }, [hardBrakes]);

  useEffect(() => {
    if (sharpTurns > prevTurns) {
      setTurnFlash(true);
      setTimeout(() => setTurnFlash(false), 1200);
    }
    setPrevTurns(sharpTurns);
  }, [sharpTurns]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m` : `${secs}s`;

  const gDisplay = currentGForce > 0 ? currentGForce.toFixed(1) : "0.0";

  return (
    <div className="flex gap-2">
      <div className={`flex-1 rounded-2xl p-3 border transition-all duration-300 ${
        brakeFlash ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-100'
      }`}>
        <div className="text-base mb-1">🛑</div>
        <div className={`text-2xl font-800 leading-none ${brakeFlash ? 'text-red-600' : 'text-gray-800'}`}>
          {hardBrakes}
        </div>
        <div className="text-[10px] text-gray-400 mt-1 font-500">Hard Brakes</div>
      </div>

      <div className={`flex-1 rounded-2xl p-3 border transition-all duration-300 ${
        turnFlash ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-100'
      }`}>
        <div className="text-base mb-1">↩️</div>
        <div className={`text-2xl font-800 leading-none ${turnFlash ? 'text-amber-600' : 'text-gray-800'}`}>
          {sharpTurns}
        </div>
        <div className="text-[10px] text-gray-400 mt-1 font-500">Sharp Turns</div>
      </div>

      <div className="flex-1 rounded-2xl p-3 border bg-gray-50 border-gray-100">
        <div className="text-base mb-1">📡</div>
        <div className="text-2xl font-800 leading-none text-gray-800">
          {gDisplay}<span className="text-xs font-400 text-gray-400 ml-0.5">g</span>
        </div>
        <div className="text-[10px] text-gray-400 mt-1 font-500">G-Force</div>
      </div>

      <div className="flex-1 rounded-2xl p-3 border bg-gray-50 border-gray-100">
        <div className="text-base mb-1">⏱️</div>
        <div className="text-2xl font-800 leading-none text-gray-800">{timeStr}</div>
        <div className="text-[10px] text-gray-400 mt-1 font-500">Trip Time</div>
      </div>
    </div>
  );
}
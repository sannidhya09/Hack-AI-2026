import { useEffect, useState } from "react";
import { AlertTriangle, Navigation } from "lucide-react";

const EVENT_LABELS = {
  hard_brake:         { label: "Hard Brake", icon: "🛑", color: "red" },
  hard_acceleration:  { label: "Hard Acceleration", icon: "⚡", color: "orange" },
  sharp_turn_right:   { label: "Sharp Turn Right", icon: "↪️", color: "amber" },
  sharp_turn_left:    { label: "Sharp Turn Left", icon: "↩️", color: "amber" },
  swerve:             { label: "Swerving", icon: "〰️", color: "red" },
  normal:             null,
};

export default function SpeedCard({ speedKmh, speedLimit, sensorData }) {
  const [prevSpeed, setPrevSpeed] = useState(speedKmh);
  const [speedDir, setSpeedDir]   = useState(null); // 'up' | 'down' | null
  const [showEvent, setShowEvent] = useState(false);

  const speedLimitKmh = Math.round(speedLimit);
  const speedLimitMph = Math.round(speedLimit / 1.60934);
  const speedMph      = Math.round(speedKmh / 1.60934);
  const isSpeeding    = speedKmh > speedLimitKmh;
  const overage       = Math.max(0, speedMph - speedLimitMph);
  const fillPct       = Math.min(100, (speedMph / (speedLimitMph * 1.4)) * 100);

  const event = sensorData?.event;
  const eventInfo = event ? EVENT_LABELS[event] : null;

  useEffect(() => {
    if (speedKmh > prevSpeed + 2) setSpeedDir("up");
    else if (speedKmh < prevSpeed - 2) setSpeedDir("down");
    else setSpeedDir(null);
    setPrevSpeed(speedKmh);
  }, [speedKmh]);

  useEffect(() => {
    if (eventInfo) {
      setShowEvent(true);
      const t = setTimeout(() => setShowEvent(false), 3000);
      return () => clearTimeout(t);
    }
  }, [event]);

  return (
    <div className={`rounded-3xl overflow-hidden shadow-sm border transition-all duration-300 ${
      isSpeeding
        ? 'border-red-200 bg-gradient-to-br from-red-50 to-white'
        : 'border-gray-100 bg-white'
    }`}>
      <div className="p-5">

        {/* Speed Numbers */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="flex items-end gap-1.5">
              <span className={`text-7xl font-900 leading-none tabular-nums transition-colors duration-300 ${
                isSpeeding ? 'text-red-600 speed-over' : 'text-gray-900'
              }`}>
                {speedMph}
              </span>
              <div className="flex flex-col items-start mb-1.5 gap-0.5">
                <span className="text-sm font-500 text-gray-400">mph</span>
                {speedDir === "up" && (
                  <span className="text-[10px] text-red-500 font-600 animate-fade-in">▲</span>
                )}
                {speedDir === "down" && (
                  <span className="text-[10px] text-green-500 font-600 animate-fade-in">▼</span>
                )}
              </div>
            </div>
          </div>

          {/* Speed Limit Badge */}
          <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border-2 transition-all ${
            isSpeeding ? 'border-red-500 bg-red-600' : 'border-gray-200 bg-gray-50'
          }`}>
            <span className={`text-[10px] font-600 uppercase tracking-wide ${
              isSpeeding ? 'text-red-100' : 'text-gray-400'
            }`}>limit</span>
            <span className={`text-xl font-800 leading-tight ${
              isSpeeding ? 'text-white' : 'text-gray-700'
            }`}>{speedLimitMph}</span>
            <span className={`text-[9px] font-500 ${
              isSpeeding ? 'text-red-100' : 'text-gray-400'
            }`}>mph</span>
          </div>
        </div>

        {/* Speed Bar */}
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
              isSpeeding ? 'bg-red-500' : 'bg-green-400'
            }`}
            style={{ width: `${fillPct}%` }}
          />
          {/* Speed limit marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-400 opacity-50"
            style={{ left: `${(speedLimitMph / (speedLimitMph * 1.4)) * 100}%` }}
          />
        </div>

        {/* Status */}
        {isSpeeding ? (
          <div className="flex items-center gap-2 bg-red-600 text-white rounded-2xl px-3 py-2 animate-fade-in">
            <AlertTriangle size={14} />
            <span className="text-xs font-600">
              {overage} mph over the speed limit
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <Navigation size={12} />
            <span className="text-xs font-400">
              {speedMph === 0 ? "Stationary" : "Speed within limit"}
            </span>
          </div>
        )}

        {/* Driving Event Toast */}
        {showEvent && eventInfo && (
          <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2 animate-slide-up">
            <span className="text-sm">{eventInfo.icon}</span>
            <span className="text-xs font-600 text-amber-700">{eventInfo.label} detected</span>
          </div>
        )}
      </div>
    </div>
  );
}

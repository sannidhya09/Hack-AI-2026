import { useState, useEffect } from "react";
import { Phone, MapPin, X } from "lucide-react";

export default function CrashAlert({ crashData, onDismiss }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 crash-bg flex flex-col items-center justify-center p-6">
      {/* Pulsing circle */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-white opacity-20 animate-ping scale-150" />
        <div className="relative w-24 h-24 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
          <span className="text-5xl">🚨</span>
        </div>
      </div>

      <h1 className="text-4xl font-900 text-white mb-2 text-center">
        CRASH DETECTED
      </h1>

      <p className="text-red-100 text-lg mb-2 text-center">
        Calling 911 in <span className="font-800 text-white text-2xl">{countdown}</span> seconds
      </p>

      <p className="text-red-200 text-sm mb-8 text-center">
        Press dismiss if you're okay
      </p>

      <div className="w-full max-w-xs space-y-3">
        {/* Call 911 */}
        <a
          href="tel:911"
          className="flex items-center justify-center gap-3 w-full bg-white text-red-600 font-700 py-4 rounded-2xl text-lg shadow-lg active:scale-95 transition-transform"
        >
          <Phone size={20} />
          Call 911 Now
        </a>

        {/* Share Location */}
        {crashData?.mapsUrl && (
          <a
            href={crashData.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-red-700 text-white font-600 py-3.5 rounded-2xl active:scale-95 transition-transform"
          >
            <MapPin size={16} />
            Share My Location
          </a>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="flex items-center justify-center gap-2 w-full bg-white bg-opacity-20 text-white font-500 py-3.5 rounded-2xl border border-white border-opacity-30 active:scale-95 transition-transform"
        >
          <X size={16} />
          I'm okay — Dismiss
        </button>
      </div>

      {/* Countdown ring */}
      <div className="mt-8">
        <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
          <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4"/>
          <circle
            cx="30" cy="30" r="26"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 26}`}
            strokeDashoffset={`${2 * Math.PI * 26 * (1 - countdown / 5)}`}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

import { Wifi, WifiOff, Mic, MicOff } from "lucide-react";
import WaveformBar from "./WaveformBar";

export default function Header({ connected, listening, aiSpeaking, micVolume }) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="px-4 py-3 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 12l9-5M12 12v10M12 12L3 7" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-800 text-gray-900 leading-none tracking-tight">
              Co <span className="text-red-600">Driver</span>
            </h1>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">AI Co-Pilot</p>
          </div>
        </div>

        {/* Status Row */}
        <div className="flex items-center gap-2">

          {/* AI Speaking Waveform */}
          {aiSpeaking && (
            <div className="flex items-center gap-1.5 bg-red-50 px-2.5 py-1.5 rounded-full">
              <WaveformBar active={true} color="red" bars={8} />
              <span className="text-[10px] font-600 text-red-600">Speaking</span>
            </div>
          )}

          {/* Mic Status */}
          <div className={`flex items-center gap-1 px-2 py-1.5 rounded-full ${
            listening ? 'bg-gray-100' : 'bg-gray-50'
          }`}>
            {listening ? (
              <Mic size={12} className="text-gray-500" />
            ) : (
              <MicOff size={12} className="text-gray-300" />
            )}
            {listening && micVolume > 20 && (
              <div className="flex gap-px items-end h-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-px bg-red-400 rounded-full transition-all duration-75"
                    style={{ height: `${Math.min(12, (micVolume / 60) * 12 * (0.5 + Math.random() * 0.5))}px` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Hardware Sensor Connection — green when ESP32 connected, gray when not */}
          <div className={`flex items-center gap-1 px-2 py-1.5 rounded-full ${
            connected ? 'bg-green-50' : 'bg-gray-50'
          }`}>
            {connected ? (
              <>
                <Wifi size={12} className="text-green-500" />
                <span className="text-[10px] font-500 text-green-600">Hardware</span>
              </>
            ) : (
              <>
                <WifiOff size={12} className="text-gray-300" />
                <span className="text-[10px] font-500 text-gray-400">No Sensor</span>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
import { CheckCircle, X } from "lucide-react";
import WaveformBar from "./WaveformBar";

export default function TripSummary({ summary, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-end justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-slide-up">

        {/* Header */}
        <div className="bg-red-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-white" />
            <div>
              <h2 className="text-white font-700 text-lg">Trip Complete!</h2>
              <p className="text-red-100 text-xs">AI Summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary */}
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm">🤖</span>
            </div>
            <div className="flex-1 bg-red-50 rounded-2xl rounded-tl-sm p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{summary.summary}</p>
            </div>
          </div>

          {/* Playing indicator */}
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-4">
            <WaveformBar active={true} color="red" bars={8} height={14} />
            <span className="text-xs">Playing summary...</span>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-red-600 text-white font-600 py-3.5 rounded-2xl active:scale-95 transition-transform"
          >
            Start New Trip
          </button>
        </div>
      </div>
    </div>
  );
}

import { Lightbulb } from "lucide-react";

export default function TipsPanel({ tips }) {
  if (!tips || tips.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-red-50 flex items-center gap-2">
        <Lightbulb size={14} className="text-red-500" />
        <span className="text-sm font-600 text-gray-700">Your Driving Tips</span>
        <span className="ml-auto text-[10px] text-gray-400 bg-red-50 px-2 py-0.5 rounded-full">
          AI · Based on your history
        </span>
      </div>
      <div className="p-4 space-y-2.5">
        {tips.map((tip, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-700 text-red-600">{i + 1}</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

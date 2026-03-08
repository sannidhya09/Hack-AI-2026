import { useEffect, useRef } from "react";
import WaveformBar from "./WaveformBar";

const TYPE_STYLES = {
  driver:  "bg-gray-50 border-gray-100 ml-8",
  normal:  "bg-red-50 border-red-100 mr-8",
  music:   "bg-purple-50 border-purple-100 mr-8",
};

export default function ConversationPanel({ conversation, aiSpeaking, listening, micVolume }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <span className="text-sm font-600 text-gray-700">Conversation</span>

        <div className="flex items-center gap-3">
          {/* AI Speaking */}
          {aiSpeaking && (
            <div className="flex items-center gap-1.5">
              <WaveformBar active={true} color="red" bars={10} height={16} />
              <span className="text-[10px] font-600 text-red-500">Speaking</span>
            </div>
          )}

          {/* Listening indicator */}
          {listening && !aiSpeaking && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-500 text-gray-400">Listening</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="p-3 max-h-56 overflow-y-auto space-y-2">
        {conversation.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-2xl mb-2">🎤</div>
            <p className="text-sm text-gray-400">CoDriver is listening...</p>
            <p className="text-xs text-gray-300 mt-1">Start driving or say something</p>
          </div>
        ) : (
          conversation.map((msg, i) => {
            const isAI    = msg.sender === "CoDriver";
            const style   = isAI
              ? (TYPE_STYLES[msg.type] || TYPE_STYLES.normal)
              : TYPE_STYLES.driver;

            return (
              <div
                key={i}
                className={`rounded-2xl p-3 border animate-slide-up ${style}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-700 uppercase tracking-wide ${
                    isAI ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {msg.sender}
                  </span>
                  <span className="text-[10px] text-gray-300">{msg.time}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{msg.text}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Hint */}
      <div className="px-4 py-2 border-t border-gray-50">
        <p className="text-[10px] text-gray-300 text-center">
          Say "play music" • Ask anything • CoDriver always listens
        </p>
      </div>
    </div>
  );
}

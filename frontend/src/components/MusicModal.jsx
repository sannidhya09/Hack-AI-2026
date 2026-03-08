import { Music, X, Youtube, ExternalLink } from "lucide-react";

export default function MusicModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-end justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-slide-up">

        {/* Header */}
        <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music size={18} className="text-white" />
            <div>
              <h2 className="text-white font-700">Music Search</h2>
              <p className="text-gray-400 text-xs truncate max-w-48">"{data.query}"</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-3">
          <a
            href={data.youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl active:scale-95 transition-transform"
            onClick={onClose}
          >
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <Youtube size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-600 text-gray-800">YouTube</p>
              <p className="text-xs text-gray-400">Search "{data.query}"</p>
            </div>
            <ExternalLink size={14} className="text-gray-300" />
          </a>

          <a
            href={data.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 bg-green-50 border border-green-100 rounded-2xl active:scale-95 transition-transform"
            onClick={onClose}
          >
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">♫</span>
            </div>
            <div className="flex-1">
              <p className="font-600 text-gray-800">Spotify</p>
              <p className="text-xs text-gray-400">Search "{data.query}"</p>
            </div>
            <ExternalLink size={14} className="text-gray-300" />
          </a>

          <button
            onClick={onClose}
            className="w-full py-3 text-sm text-gray-400 font-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

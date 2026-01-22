/**
 * HostControls Component
 *
 * Playback controls for host and co-hosts only.
 */

"use client";

interface HostControlsProps {
  isPlaying: boolean;
  canControl: boolean;
  onPlay: () => void;
  onPause: () => void;
}

export default function HostControls({
  isPlaying,
  canControl,
  onPlay,
  onPause,
}: HostControlsProps) {
  if (!canControl) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="bg-black/80 backdrop-blur rounded-lg px-4 py-2 shadow-lg border border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            Host Controls
          </span>
          <div className="flex gap-2">
            {isPlaying ? (
              <button
                onClick={onPause}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2"
                title="Pause for everyone"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                </svg>
                Pause
              </button>
            ) : (
              <button
                onClick={onPlay}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
                title="Play for everyone"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6 4l10 6-10 6V4z" />
                </svg>
                Play
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

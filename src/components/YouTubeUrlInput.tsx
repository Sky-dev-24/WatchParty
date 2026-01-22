/**
 * YouTubeUrlInput Component
 *
 * Input field for YouTube URLs with validation and video ID extraction.
 */

"use client";

import { useState } from "react";

interface YouTubeUrlInputProps {
  onVideoSelect: (videoId: string, url: string) => void;
}

export default function YouTubeUrlInput({ onVideoSelect }: YouTubeUrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const extractVideoId = (input: string): string | null => {
    // Remove whitespace
    input = input.trim();

    // Direct video ID (11 characters)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }

    // Standard YouTube URL
    const standardMatch = input.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (standardMatch) {
      return standardMatch[1];
    }

    // Embed URL
    const embedMatch = input.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) {
      return embedMatch[1];
    }

    // Shorts URL
    const shortsMatch = input.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) {
      return shortsMatch[1];
    }

    return null;
  };

  const handleChange = (value: string) => {
    setUrl(value);
    setError(null);
    setVideoId(null);

    if (!value.trim()) {
      return;
    }

    const id = extractVideoId(value);
    if (id) {
      setVideoId(id);
      setError(null);
    } else {
      setError("Invalid YouTube URL or video ID");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!videoId) {
      setError("Please enter a valid YouTube URL or video ID");
      return;
    }

    onVideoSelect(videoId, url);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          YouTube URL or Video ID
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or video ID"
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 border border-gray-700"
        />
        <div className="text-xs text-gray-500 mt-2">
          Supports: youtube.com/watch, youtu.be, youtube.com/shorts, or direct video ID
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {videoId && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt="Video thumbnail"
                className="w-32 h-24 object-cover rounded"
              />
            </div>
            <div className="flex-1">
              <div className="text-sm text-green-400 font-semibold mb-1">
                ✓ Valid YouTube video
              </div>
              <div className="text-xs text-gray-400">
                Video ID: <span className="font-mono text-white">{videoId}</span>
              </div>
              <button
                type="submit"
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
              >
                Use This Video
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

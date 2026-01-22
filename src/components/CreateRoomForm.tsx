/**
 * CreateRoomForm Component
 *
 * Complete form for creating watch party rooms.
 * Supports YouTube and Plex video sources.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import YouTubeUrlInput from "./YouTubeUrlInput";
import PlexAuthButton from "./PlexAuthButton";
import PlexLibraryBrowser from "./PlexLibraryBrowser";

type VideoSource = "youtube" | "plex";

interface RoomFormData {
  name: string;
  videoType: VideoSource;
  videoId: string;
  videoUrl?: string;
  videoDuration?: number;
  isPublic: boolean;
  isPersistent: boolean;
  hostDisplayName: string;
  plexServerUrl?: string;
  plexServerId?: string;
}

export default function CreateRoomForm() {
  const router = useRouter();

  const [videoSource, setVideoSource] = useState<VideoSource>("youtube");
  const [plexAuthenticated, setPlexAuthenticated] = useState(false);

  const [formData, setFormData] = useState<Partial<RoomFormData>>({
    name: "",
    isPublic: true,
    isPersistent: false,
    hostDisplayName: "",
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleYouTubeSelect = (videoId: string, url: string) => {
    setFormData((prev) => ({
      ...prev,
      videoType: "youtube",
      videoId,
      videoUrl: url,
    }));
  };

  const handlePlexSelect = (video: {
    ratingKey: string;
    title: string;
    duration: number;
    serverUrl: string;
    serverId: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      videoType: "plex",
      videoId: video.ratingKey,
      videoUrl: `plex://${video.serverId}/${video.ratingKey}`,
      videoDuration: video.duration,
      plexServerUrl: video.serverUrl,
      plexServerId: video.serverId,
      name: prev.name || video.title, // Auto-fill room name with video title
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name?.trim()) {
      setError("Room name is required");
      return;
    }

    if (!formData.hostDisplayName?.trim()) {
      setError("Your display name is required");
      return;
    }

    if (!formData.videoId) {
      setError("Please select a video");
      return;
    }

    try {
      setCreating(true);

      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create room");
      }

      const data = await response.json();

      // Save display name for future
      localStorage.setItem("watchparty_displayname", formData.hostDisplayName!);

      // Navigate to room
      router.push(`/watch/${data.room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Room Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Room Name *
        </label>
        <input
          type="text"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Friday Movie Night"
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
          required
        />
      </div>

      {/* Your Display Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Your Display Name *
        </label>
        <input
          type="text"
          value={formData.hostDisplayName || ""}
          onChange={(e) =>
            setFormData({ ...formData, hostDisplayName: e.target.value })
          }
          placeholder="Your name"
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
          maxLength={30}
          required
        />
      </div>

      {/* Video Source Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Video Source *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setVideoSource("youtube")}
            className={`px-4 py-3 rounded-lg border transition-colors ${
              videoSource === "youtube"
                ? "bg-red-600 border-red-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <div className="font-semibold">YouTube</div>
            <div className="text-xs text-gray-400 mt-1">
              Public YouTube videos
            </div>
          </button>
          <button
            type="button"
            onClick={() => setVideoSource("plex")}
            className={`px-4 py-3 rounded-lg border transition-colors ${
              videoSource === "plex"
                ? "bg-orange-600 border-orange-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <div className="font-semibold">Plex</div>
            <div className="text-xs text-gray-400 mt-1">
              Your Plex library
            </div>
          </button>
        </div>
      </div>

      {/* YouTube Input */}
      {videoSource === "youtube" && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <YouTubeUrlInput onVideoSelect={handleYouTubeSelect} />
        </div>
      )}

      {/* Plex Authentication & Browser */}
      {videoSource === "plex" && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          {!plexAuthenticated ? (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Connect Plex Account
              </h3>
              <PlexAuthButton onAuthenticated={() => setPlexAuthenticated(true)} />
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Select Plex Video
              </h3>
              <PlexLibraryBrowser onVideoSelect={handlePlexSelect} />
            </div>
          )}
        </div>
      )}

      {/* Room Settings */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-semibold text-white">Room Settings</h3>

        {/* Public/Private */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="isPublic"
            checked={formData.isPublic ?? true}
            onChange={(e) =>
              setFormData({ ...formData, isPublic: e.target.checked })
            }
            className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="isPublic" className="flex-1">
            <div className="font-medium text-white">Public Room</div>
            <div className="text-sm text-gray-400">
              Anyone can find and join this room. Uncheck for invite-only.
            </div>
          </label>
        </div>

        {/* Persistent */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="isPersistent"
            checked={formData.isPersistent ?? false}
            onChange={(e) =>
              setFormData({ ...formData, isPersistent: e.target.checked })
            }
            className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="isPersistent" className="flex-1">
            <div className="font-medium text-white">Save Room</div>
            <div className="text-sm text-gray-400">
              Keep this room after everyone leaves. Uncheck for temporary.
            </div>
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={creating || !formData.videoId}
        className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
      >
        {creating ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Creating Room...
          </span>
        ) : (
          "Create Watch Party"
        )}
      </button>
    </form>
  );
}

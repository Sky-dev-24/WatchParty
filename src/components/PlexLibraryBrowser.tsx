/**
 * PlexLibraryBrowser Component
 *
 * Browse Plex servers, libraries, and select videos for watch party.
 */

"use client";

import { useState, useEffect } from "react";

interface PlexServer {
  name: string;
  machineIdentifier: string;
  url: string;
  version: string;
}

interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

interface PlexVideo {
  ratingKey: string;
  title: string;
  year?: number;
  summary?: string;
  duration: number;
  thumb?: string;
  type: string;
}

interface PlexLibraryBrowserProps {
  onVideoSelect: (video: {
    ratingKey: string;
    title: string;
    duration: number;
    serverUrl: string;
    serverId: string;
  }) => void;
}

export default function PlexLibraryBrowser({ onVideoSelect }: PlexLibraryBrowserProps) {
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<PlexServer | null>(null);
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<PlexLibrary | null>(null);
  const [videos, setVideos] = useState<PlexVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/plex/servers");
      if (!response.ok) throw new Error("Failed to load servers");

      const data = await response.json();
      setServers(data.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load servers");
    } finally {
      setLoading(false);
    }
  };

  const loadLibraries = async (server: PlexServer) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedServer(server);
      setLibraries([]);
      setVideos([]);
      setSelectedLibrary(null);

      const response = await fetch(
        `/api/plex/libraries?serverUrl=${encodeURIComponent(server.url)}`
      );
      if (!response.ok) throw new Error("Failed to load libraries");

      const data = await response.json();
      setLibraries(data.libraries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load libraries");
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async (library: PlexLibrary) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedLibrary(library);
      setVideos([]);

      if (!selectedServer) return;

      const response = await fetch(
        `/api/plex/library/${library.key}/videos?serverUrl=${encodeURIComponent(selectedServer.url)}`
      );
      if (!response.ok) throw new Error("Failed to load videos");

      const data = await response.json();
      setVideos(data.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (video: PlexVideo) => {
    if (!selectedServer) return;

    onVideoSelect({
      ratingKey: video.ratingKey,
      title: video.title,
      duration: video.duration,
      serverUrl: selectedServer.url,
      serverId: selectedServer.machineIdentifier,
    });
  };

  if (servers.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-gray-400">
        No Plex servers found. Please connect your Plex account first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Server Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Plex Server
        </label>
        <div className="grid grid-cols-1 gap-2">
          {servers.map((server) => (
            <button
              key={server.machineIdentifier}
              onClick={() => loadLibraries(server)}
              className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                selectedServer?.machineIdentifier === server.machineIdentifier
                  ? "bg-orange-600 border-orange-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <div className="font-semibold">{server.name}</div>
              <div className="text-xs text-gray-400 mt-1">v{server.version}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Library Selection */}
      {selectedServer && libraries.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Library
          </label>
          <div className="grid grid-cols-2 gap-2">
            {libraries.map((library) => (
              <button
                key={library.key}
                onClick={() => loadVideos(library)}
                className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedLibrary?.key === library.key
                    ? "bg-orange-600 border-orange-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                }`}
              >
                <div className="font-semibold">{library.title}</div>
                <div className="text-xs text-gray-400 mt-1 capitalize">
                  {library.type}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video List */}
      {selectedLibrary && videos.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Video ({videos.length} available)
          </label>
          <div className="max-h-96 overflow-y-auto space-y-2 bg-gray-900 rounded-lg p-2">
            {videos.map((video) => (
              <button
                key={video.ratingKey}
                onClick={() => handleVideoSelect(video)}
                className="w-full text-left px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {video.thumb && (
                    <img
                      src={video.thumb}
                      alt={video.title}
                      className="w-16 h-24 object-cover rounded flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                      {video.title}
                      {video.year && (
                        <span className="text-gray-400 ml-2">({video.year})</span>
                      )}
                    </div>
                    {video.summary && (
                      <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {video.summary}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Duration: {Math.floor(video.duration / 60)} min
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

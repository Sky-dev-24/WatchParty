/**
 * Watch Party Homepage
 *
 * Displays public watch party rooms and join with room code option.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Room {
  slug: string;
  name: string;
  videoType: string;
  isPublic: boolean;
  isPersistent: boolean;
  isPlaying: boolean;
  participantCount: number;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [joiningWithCode, setJoiningWithCode] = useState(false);

  useEffect(() => {
    loadRooms();
    // Refresh every 30 seconds
    const interval = setInterval(loadRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadRooms = async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to load rooms");

      const data = await response.json();
      setRooms(data.rooms);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    try {
      setJoiningWithCode(true);
      setError(null);

      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: roomCode.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join room");
      }

      const data = await response.json();
      router.push(`/watch/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setJoiningWithCode(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Watch Party</h1>
          <p className="text-gray-400">Join a watch party or create your own</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Public Rooms */}
            <div>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Active Watch Parties
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rooms.length === 0 ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-12 text-center">
                  <div className="text-4xl mb-4">🎬</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No Active Watch Parties
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Be the first to start a watch party!
                  </p>
                  <Link
                    href="/admin/(protected)/create-room"
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Create Watch Party
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {rooms.map((room) => (
                    <Link
                      key={room.slug}
                      href={`/watch/${room.slug}`}
                      className="block bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-lg p-6 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors mb-2">
                            {room.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  room.isPlaying ? "bg-green-500" : "bg-yellow-500"
                                }`}
                              />
                              {room.isPlaying ? "Playing" : "Paused"}
                            </div>
                            <div className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                              </svg>
                              {room.participantCount} watching
                            </div>
                            <div className="capitalize flex items-center gap-1">
                              {room.videoType === "youtube" ? (
                                <span className="text-red-500">▶</span>
                              ) : (
                                <span className="text-orange-500">📺</span>
                              )}
                              {room.videoType}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full font-semibold">
                            Join
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Join with Code */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Join with Room Code
              </h3>
              <form onSubmit={handleJoinWithCode} className="space-y-3">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ABCD12"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-center text-lg font-mono tracking-widest"
                  maxLength={6}
                  pattern="[A-Z0-9]{6}"
                />
                <button
                  type="submit"
                  disabled={roomCode.length !== 6 || joiningWithCode}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {joiningWithCode ? "Joining..." : "Join Room"}
                </button>
              </form>
            </div>

            {/* Create Room */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Host a Watch Party
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Create your own watch party with YouTube or Plex videos
              </p>
              <Link
                href="/admin/(protected)/create-room"
                className="block w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-center"
              >
                Create Watch Party
              </Link>
            </div>

            {/* Features */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Features
              </h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Synchronized playback</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Real-time chat</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Host controls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>YouTube & Plex support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Co-host permissions</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}

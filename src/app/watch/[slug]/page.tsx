/**
 * Watch Party Page
 *
 * Main page for watching videos together in real-time.
 * Handles room joining with display name prompt.
 */

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import WatchPartyRoom from "@/components/WatchPartyRoom";

export default function WatchPage() {
  const params = useParams();
  const roomSlug = typeof params?.slug === "string" ? params.slug : "";

  const [displayName, setDisplayName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [inputName, setInputName] = useState("");

  // Check for saved display name in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("watchparty_displayname");
    if (saved) {
      setDisplayName(saved);
      setHasJoined(true);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      const name = inputName.trim();
      setDisplayName(name);
      localStorage.setItem("watchparty_displayname", name);
      setHasJoined(true);
    }
  };

  if (!roomSlug) {
    return null;
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full border border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-2">Join Watch Party</h1>
          <p className="text-gray-400 mb-6">
            Enter your display name to join the watch party
          </p>

          <form onSubmit={handleJoin}>
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-gray-800 text-white rounded px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={30}
              autoFocus
              required
            />

            <button
              type="submit"
              className="w-full bg-blue-600 text-white rounded px-4 py-3 hover:bg-blue-700 transition-colors font-semibold"
            >
              Join Watch Party
            </button>
          </form>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Your display name will be visible to other participants
          </p>
        </div>
      </div>
    );
  }

  return <WatchPartyRoom roomSlug={roomSlug} initialDisplayName={displayName} />;
}

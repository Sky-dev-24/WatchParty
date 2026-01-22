/**
 * Create Room Admin Page
 *
 * Admin interface for creating new watch party rooms.
 */

"use client";

import CreateRoomForm from "@/components/CreateRoomForm";

export default function CreateRoomPage() {
  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Create Watch Party
          </h1>
          <p className="text-gray-400">
            Set up a new watch party room with YouTube or Plex videos
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
          <CreateRoomForm />
        </div>
      </div>
    </div>
  );
}

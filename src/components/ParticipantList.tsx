/**
 * ParticipantList Component
 *
 * Displays list of all participants in the room.
 */

"use client";

import ParticipantItem from "./ParticipantItem";
import type { ParticipantInfo } from "@/lib/socket-server";

interface ParticipantListProps {
  participants: ParticipantInfo[];
  currentSessionId: string | null;
  currentUserIsHost: boolean;
  onGrantControl: (sessionId: string) => void;
  onRevokeControl: (sessionId: string) => void;
  onTransferHost: (sessionId: string) => void;
}

export default function ParticipantList({
  participants,
  currentSessionId,
  currentUserIsHost,
  onGrantControl,
  onRevokeControl,
  onTransferHost,
}: ParticipantListProps) {
  // Sort: host first, then co-hosts, then others
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.isHost) return -1;
    if (b.isHost) return 1;
    if (a.canControl && !b.canControl) return -1;
    if (b.canControl && !a.canControl) return 1;
    return 0;
  });

  const onlineCount = participants.filter((p) => p.isOnline).length;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">
          Participants ({onlineCount})
        </h2>
      </div>

      {/* List */}
      <div className="p-2 max-h-64 overflow-y-auto">
        {sortedParticipants.map((participant) => (
          <ParticipantItem
            key={participant.sessionId}
            participant={participant}
            isCurrentUser={participant.sessionId === currentSessionId}
            currentUserIsHost={currentUserIsHost}
            onGrantControl={onGrantControl}
            onRevokeControl={onRevokeControl}
            onTransferHost={onTransferHost}
          />
        ))}
      </div>
    </div>
  );
}

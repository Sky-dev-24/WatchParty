/**
 * ParticipantItem Component
 *
 * Displays a single participant with badges and controls.
 */

"use client";

import type { ParticipantInfo } from "@/lib/socket-server";

interface ParticipantItemProps {
  participant: ParticipantInfo;
  isCurrentUser: boolean;
  currentUserIsHost: boolean;
  onGrantControl?: (sessionId: string) => void;
  onRevokeControl?: (sessionId: string) => void;
  onTransferHost?: (sessionId: string) => void;
}

export default function ParticipantItem({
  participant,
  isCurrentUser,
  currentUserIsHost,
  onGrantControl,
  onRevokeControl,
  onTransferHost,
}: ParticipantItemProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/50 rounded group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Online status */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            participant.isOnline ? "bg-green-500" : "bg-gray-500"
          }`}
        />

        {/* Name */}
        <span className="text-white truncate">
          {participant.displayName}
          {isCurrentUser && (
            <span className="text-gray-500 ml-1">(you)</span>
          )}
        </span>

        {/* Badges */}
        <div className="flex gap-1 flex-shrink-0">
          {participant.isHost && (
            <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded">
              Host
            </span>
          )}
          {participant.canControl && !participant.isHost && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
              Co-host
            </span>
          )}
        </div>
      </div>

      {/* Host controls */}
      {currentUserIsHost && !isCurrentUser && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!participant.canControl && (
            <button
              onClick={() => onGrantControl?.(participant.sessionId)}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="Grant co-host"
            >
              Grant Control
            </button>
          )}
          {participant.canControl && (
            <button
              onClick={() => onRevokeControl?.(participant.sessionId)}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              title="Revoke co-host"
            >
              Revoke Control
            </button>
          )}
          <button
            onClick={() => onTransferHost?.(participant.sessionId)}
            className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            title="Transfer host"
          >
            Make Host
          </button>
        </div>
      )}
    </div>
  );
}

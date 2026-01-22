/**
 * ChatMessage Component
 *
 * Displays a single chat message with timestamp and author.
 */

"use client";

import type { ChatMessage as ChatMessageType } from "@/lib/socket-server";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const timestamp = new Date(message.timestamp);
  const timeString = timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex gap-2 px-3 py-2 hover:bg-gray-800/50 group">
      <div className="flex-shrink-0 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity w-12">
        {timeString}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-blue-400">{message.displayName}</span>
        <span className="text-gray-400 mx-2">:</span>
        <span className="text-gray-200 break-words">{message.message}</span>
      </div>
    </div>
  );
}

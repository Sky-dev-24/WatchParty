/**
 * WatchPartyRoom Component
 *
 * Main container for watch party experience.
 * Integrates video player, chat, participants, and controls.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { usePlaybackSync } from "@/hooks/usePlaybackSync";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/VideoPlayer";
import ChatPanel from "@/components/ChatPanel";
import ParticipantList from "@/components/ParticipantList";
import HostControls from "@/components/HostControls";
import type {
  PlaybackState,
  ChatMessage,
  ParticipantInfo,
} from "@/lib/socket-server";

interface WatchPartyRoomProps {
  roomSlug: string;
  initialDisplayName: string;
}

export default function WatchPartyRoom({
  roomSlug,
  initialDisplayName,
}: WatchPartyRoomProps) {
  const playerRef = useRef<VideoPlayerHandle>(null);

  const [roomInfo, setRoomInfo] = useState<{
    name: string;
    videoType: "youtube" | "plex";
    videoId: string;
    videoUrl?: string;
    videoDuration?: number;
    plexServerUrl?: string;
    plexToken?: string;
  } | null>(null);

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentPosition: 0,
    timestamp: Date.now(),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);

  // Socket connection
  const socket = useSocket({
    roomSlug,
    displayName: initialDisplayName,
    onPlaybackState: (state) => {
      setPlaybackState(state);
    },
    onChatMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onChatHistory: (history) => {
      setMessages(history);
    },
    onParticipantList: (list) => {
      setParticipants(list);
    },
    onHostChanged: (newHostSessionId) => {
      console.log("Host changed to:", newHostSessionId);
    },
    onYouAreHost: () => {
      console.log("You are now the host!");
    },
    onControlGranted: () => {
      console.log("You've been granted co-host permissions!");
    },
    onControlRevoked: () => {
      console.log("Your co-host permissions have been revoked");
    },
    onRoomInfo: (room) => {
      if (room) {
        setRoomInfo({
          name: room.name,
          videoType: room.videoType as "youtube" | "plex",
          videoId: room.videoId,
          videoUrl: room.videoUrl,
          videoDuration: room.videoDuration,
          plexServerUrl: room.plexServerUrl,
          plexToken: room.plexToken,
        });
      }
    },
    onError: (error) => {
      console.error("Socket error:", error);
    },
  });

  // Playback synchronization
  const { applyPlaybackState, reportPlaybackChange } = usePlaybackSync({
    player: playerRef.current,
    isHost: socket.isHost,
    onPlaybackChange: (isPlaying, position) => {
      // Host reports playback changes
      if (isPlaying) {
        socket.play();
      } else {
        socket.pause();
      }
    },
  });

  // Apply playback state changes
  useEffect(() => {
    if (playbackState) {
      applyPlaybackState(playbackState);
    }
  }, [playbackState, applyPlaybackState]);

  // Request chat history on connect
  useEffect(() => {
    if (socket.connected) {
      socket.requestChatHistory();
    }
  }, [socket.connected]);

  // Handle video player events
  const handlePlayerReady = useCallback(() => {
    console.log("Player ready");
    // Request initial sync
    socket.requestSync();
  }, [socket]);

  const handlePlayerPlay = useCallback(() => {
    if (socket.isHost || socket.canControl) {
      const currentTime = playerRef.current?.getCurrentTime() || 0;
      reportPlaybackChange(true, currentTime);
    }
  }, [socket.isHost, socket.canControl, reportPlaybackChange]);

  const handlePlayerPause = useCallback(() => {
    if (socket.isHost || socket.canControl) {
      const currentTime = playerRef.current?.getCurrentTime() || 0;
      reportPlaybackChange(false, currentTime);
    }
  }, [socket.isHost, socket.canControl, reportPlaybackChange]);

  const handlePlayerSeek = useCallback(
    (time: number) => {
      if (socket.isHost || socket.canControl) {
        socket.seek(time);
      }
    },
    [socket]
  );

  // Host control handlers
  const handleHostPlay = useCallback(() => {
    socket.play();
  }, [socket]);

  const handleHostPause = useCallback(() => {
    socket.pause();
  }, [socket]);

  if (!socket.connected || !roomInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-white text-lg">Connecting to watch party...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">{roomInfo.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`w-2 h-2 rounded-full ${
                socket.connected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-400">
              {participants.filter((p) => p.isOnline).length} watching
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main video area */}
          <div className="lg:col-span-2">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <VideoPlayer
                ref={playerRef}
                source={roomInfo.videoType}
                videoId={roomInfo.videoId}
                videoUrl={roomInfo.videoUrl}
                plexServerUrl={roomInfo.plexServerUrl}
                plexToken={roomInfo.plexToken}
                onReady={handlePlayerReady}
                onPlay={handlePlayerPlay}
                onPause={handlePlayerPause}
                onSeek={handlePlayerSeek}
              />

              {/* Host controls overlay */}
              <HostControls
                isPlaying={playbackState.isPlaying}
                canControl={socket.canControl || socket.isHost}
                onPlay={handleHostPlay}
                onPause={handleHostPause}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Participants */}
            <ParticipantList
              participants={participants}
              currentSessionId={socket.sessionId}
              currentUserIsHost={socket.isHost}
              onGrantControl={socket.grantControl}
              onRevokeControl={socket.revokeControl}
              onTransferHost={socket.transferHost}
            />

            {/* Chat */}
            <div className="flex-1 min-h-[400px] lg:min-h-0">
              <ChatPanel
                messages={messages}
                onSendMessage={socket.sendMessage}
                connected={socket.connected}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

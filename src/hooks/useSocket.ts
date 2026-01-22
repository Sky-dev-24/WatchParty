/**
 * useSocket Hook
 *
 * React hook for managing Socket.io connection and event handling.
 * Handles connection lifecycle, room joining, and event subscriptions.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinResult,
  PlaybackState,
  ChatMessage,
  ParticipantInfo,
} from "@/lib/socket-server";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface UseSocketOptions {
  roomSlug: string;
  displayName: string;
  onPlaybackState?: (state: PlaybackState) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onChatHistory?: (messages: ChatMessage[]) => void;
  onParticipantList?: (participants: ParticipantInfo[]) => void;
  onHostChanged?: (newHostSessionId: string) => void;
  onYouAreHost?: () => void;
  onControlGranted?: () => void;
  onControlRevoked?: () => void;
  onError?: (message: string) => void;
}

export interface UseSocketReturn {
  socket: TypedSocket | null;
  connected: boolean;
  sessionId: string | null;
  isHost: boolean;
  canControl: boolean;
  // Playback controls
  play: () => void;
  pause: () => void;
  seek: (position: number) => void;
  requestSync: () => void;
  // Chat
  sendMessage: (message: string) => void;
  requestChatHistory: () => void;
  // Participant management
  grantControl: (sessionId: string) => void;
  revokeControl: (sessionId: string) => void;
  transferHost: (sessionId: string) => void;
  // Connection
  disconnect: () => void;
}

export function useSocket(options: UseSocketOptions): UseSocketReturn {
  const {
    roomSlug,
    displayName,
    onPlaybackState,
    onChatMessage,
    onChatHistory,
    onParticipantList,
    onHostChanged,
    onYouAreHost,
    onControlGranted,
    onControlRevoked,
    onError,
  } = options;

  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [canControl, setCanControl] = useState(false);

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }) as TypedSocket;

    setSocket(newSocket);

    // Connection events
    newSocket.on("connect", () => {
      console.log("[Socket] Connected");
      setConnected(true);

      // Join room on connect
      newSocket.emit("room:join", roomSlug, displayName, (result: JoinResult) => {
        if (result.success) {
          console.log("[Socket] Joined room successfully");
          setSessionId(result.sessionId || null);

          // Check initial host/control status
          const self = result.participants?.find(
            (p) => p.sessionId === result.sessionId
          );
          if (self) {
            setIsHost(self.isHost);
            setCanControl(self.canControl || self.isHost);
          }

          // Send initial playback state
          if (result.playbackState && onPlaybackState) {
            onPlaybackState(result.playbackState);
          }

          // Start heartbeat
          heartbeatIntervalRef.current = setInterval(() => {
            newSocket.emit("heartbeat");
          }, 30000); // Every 30 seconds
        } else {
          console.error("[Socket] Failed to join room:", result.error);
          if (onError) onError(result.error || "Failed to join room");
        }
      });
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setConnected(false);

      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
      if (onError) onError("Connection error");
    });

    // Server events
    newSocket.on("playback:state", (state) => {
      if (onPlaybackState) onPlaybackState(state);
    });

    newSocket.on("chat:new", (message) => {
      if (onChatMessage) onChatMessage(message);
    });

    newSocket.on("chat:history", (messages) => {
      if (onChatHistory) onChatHistory(messages);
    });

    newSocket.on("participant:list", (participants) => {
      // Update own status
      const self = participants.find((p) => p.sessionId === sessionId);
      if (self) {
        setIsHost(self.isHost);
        setCanControl(self.canControl || self.isHost);
      }

      if (onParticipantList) onParticipantList(participants);
    });

    newSocket.on("host:changed", (newHostSessionId) => {
      // Update own host status
      if (sessionId === newHostSessionId) {
        setIsHost(true);
        setCanControl(true);
      } else {
        setIsHost(false);
      }

      if (onHostChanged) onHostChanged(newHostSessionId);
    });

    newSocket.on("you_are_host", () => {
      setIsHost(true);
      setCanControl(true);
      if (onYouAreHost) onYouAreHost();
    });

    newSocket.on("control:granted", () => {
      setCanControl(true);
      if (onControlGranted) onControlGranted();
    });

    newSocket.on("control:revoked", () => {
      setCanControl(false);
      if (onControlRevoked) onControlRevoked();
    });

    newSocket.on("error", (message) => {
      console.error("[Socket] Server error:", message);
      if (onError) onError(message);
    });

    // Cleanup
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      newSocket.emit("room:leave");
      newSocket.close();
    };
  }, [roomSlug, displayName]); // Only reconnect if room/name changes

  // Playback control functions
  const play = useCallback(() => {
    socket?.emit("playback:play");
  }, [socket]);

  const pause = useCallback(() => {
    socket?.emit("playback:pause");
  }, [socket]);

  const seek = useCallback(
    (position: number) => {
      socket?.emit("playback:seek", position);
    },
    [socket]
  );

  const requestSync = useCallback(() => {
    socket?.emit("playback:sync");
  }, [socket]);

  // Chat functions
  const sendMessage = useCallback(
    (message: string) => {
      socket?.emit("chat:message", message);
    },
    [socket]
  );

  const requestChatHistory = useCallback(() => {
    socket?.emit("chat:request_history");
  }, [socket]);

  // Participant management functions
  const grantControl = useCallback(
    (targetSessionId: string) => {
      socket?.emit("participant:grant_control", targetSessionId);
    },
    [socket]
  );

  const revokeControl = useCallback(
    (targetSessionId: string) => {
      socket?.emit("participant:revoke_control", targetSessionId);
    },
    [socket]
  );

  const transferHost = useCallback(
    (targetSessionId: string) => {
      socket?.emit("host:transfer", targetSessionId);
    },
    [socket]
  );

  // Disconnect function
  const disconnect = useCallback(() => {
    socket?.emit("room:leave");
    socket?.close();
  }, [socket]);

  return {
    socket,
    connected,
    sessionId,
    isHost,
    canControl,
    play,
    pause,
    seek,
    requestSync,
    sendMessage,
    requestChatHistory,
    grantControl,
    revokeControl,
    transferHost,
    disconnect,
  };
}

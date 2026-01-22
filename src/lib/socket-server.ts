/**
 * Socket.io Server Setup with Redis Adapter
 *
 * Handles real-time WebSocket communication for watch party platform.
 * Uses Redis adapter for horizontal scaling across cluster workers.
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Socket } from "socket.io";
import { isRedisConfigured } from "@/lib/redis";

let io: SocketIOServer | null = null;

export interface ServerToClientEvents {
  // Playback events
  "playback:state": (state: PlaybackState) => void;

  // Chat events
  "chat:new": (message: ChatMessage) => void;
  "chat:history": (messages: ChatMessage[]) => void;

  // Participant events
  "participant:list": (participants: ParticipantInfo[]) => void;
  "host:changed": (newHostSessionId: string) => void;
  "you_are_host": () => void;

  // Control permission events
  "control:granted": () => void;
  "control:revoked": () => void;

  // Connection events
  "error": (message: string) => void;
}

export interface ClientToServerEvents {
  // Join/leave
  "room:join": (roomSlug: string, displayName: string, callback: (result: JoinResult) => void) => void;
  "room:leave": () => void;

  // Playback control
  "playback:play": () => void;
  "playback:pause": () => void;
  "playback:seek": (position: number) => void;
  "playback:sync": () => void;

  // Chat
  "chat:message": (message: string) => void;
  "chat:request_history": () => void;

  // Participant management
  "participant:grant_control": (sessionId: string) => void;
  "participant:revoke_control": (sessionId: string) => void;
  "host:transfer": (sessionId: string) => void;

  // Heartbeat
  "heartbeat": () => void;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentPosition: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  displayName: string;
  message: string;
  timestamp: number;
}

export interface ParticipantInfo {
  sessionId: string;
  displayName: string;
  isHost: boolean;
  canControl: boolean;
  isOnline: boolean;
}

export interface JoinResult {
  success: boolean;
  sessionId?: string;
  room?: {
    name: string;
    videoType: string;
    videoId: string;
    videoUrl?: string;
    videoDuration?: number;
    plexServerUrl?: string;
    plexToken?: string;
  };
  playbackState?: PlaybackState;
  participants?: ParticipantInfo[];
  error?: string;
}

/**
 * Initialize Socket.io server with Redis adapter
 */
export async function initSocketServer(httpServer: HTTPServer): Promise<SocketIOServer> {
  if (io) {
    return io;
  }

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? false // In production, rely on same-origin
        : "*", // In development, allow all origins
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Setup Redis adapter for multi-worker scaling
  if (isRedisConfigured()) {
    try {
      const redisUrl = process.env.REDIS_URL!;

      // Create redis v4 clients for Socket.io adapter (separate from ioredis)
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) => console.error("[Redis Pub] Error:", err));
      subClient.on("error", (err) => console.error("[Redis Sub] Error:", err));

      await Promise.all([
        pubClient.connect(),
        subClient.connect(),
      ]);

      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket.io] Redis adapter initialized for multi-worker support");
    } catch (error) {
      console.error("[Socket.io] Failed to initialize Redis adapter:", error);
      console.warn("[Socket.io] Continuing without Redis adapter");
    }
  } else {
    console.warn("[Socket.io] REDIS_URL not configured - running without adapter (single worker only)");
  }

  // Connection handling
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`[Socket.io] Socket error for ${socket.id}:`, error);
    });
  });

  console.log("[Socket.io] Server initialized");
  return io;
}

/**
 * Get the initialized Socket.io server instance
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast playback state to all participants in a room
 */
export function broadcastPlaybackState(roomSlug: string, state: PlaybackState): void {
  if (!io) return;
  io.to(roomSlug).emit("playback:state", state);
}

/**
 * Broadcast new chat message to all participants in a room
 */
export function broadcastChatMessage(roomSlug: string, message: ChatMessage): void {
  if (!io) return;
  io.to(roomSlug).emit("chat:new", message);
}

/**
 * Broadcast participant list update to all participants in a room
 */
export function broadcastParticipantList(roomSlug: string, participants: ParticipantInfo[]): void {
  if (!io) return;
  io.to(roomSlug).emit("participant:list", participants);
}

/**
 * Notify all participants of a host change
 */
export function notifyHostChanged(roomSlug: string, newHostSessionId: string, socketIdOfNewHost: string): void {
  if (!io) return;

  // Notify all participants
  io.to(roomSlug).emit("host:changed", newHostSessionId);

  // Send special notification to new host
  const newHostSocket = Array.from(io.sockets.sockets.values())
    .find(s => s.id === socketIdOfNewHost);

  if (newHostSocket) {
    newHostSocket.emit("you_are_host");
  }
}

/**
 * Grant control permission to a specific participant
 */
export function notifyControlGranted(socketId: string): void {
  if (!io) return;
  io.to(socketId).emit("control:granted");
}

/**
 * Revoke control permission from a specific participant
 */
export function notifyControlRevoked(socketId: string): void {
  if (!io) return;
  io.to(socketId).emit("control:revoked");
}

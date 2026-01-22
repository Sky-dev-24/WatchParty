/**
 * Socket.io Event Handlers
 *
 * Implements all real-time event handling for watch party platform:
 * - Room join/leave
 * - Playback control (play/pause/seek)
 * - Chat messaging
 * - Participant management (permissions, host transfer)
 */

import type { Socket, Server as SocketIOServer } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinResult,
  PlaybackState,
  ChatMessage,
  ParticipantInfo,
} from "@/lib/socket-server";
import {
  getRoomBySlug,
  updatePlaybackState,
  transferHost,
  findNextHost,
  deleteRoom,
} from "@/lib/room";
import {
  joinRoom as dbJoinRoom,
  leaveRoom as dbLeaveRoom,
  grantControl,
  revokeControl,
  getOnlineParticipants,
  hasControlPermission,
  isHost,
  updateLastSeen,
} from "@/lib/participant";
import { getCached, setCached, isRedisConfigured } from "@/lib/redis";
import { randomBytes } from "crypto";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

// Track socket ID to session ID mapping
const socketToSession = new Map<string, string>();
const socketToRoom = new Map<string, string>();

/**
 * Initialize all event handlers for a socket connection
 */
export function registerSocketHandlers(
  io: TypedServer,
  socket: TypedSocket
): void {
  // Room management
  socket.on("room:join", async (roomSlug, displayName, callback) => {
    await handleRoomJoin(io, socket, roomSlug, displayName, callback);
  });

  socket.on("room:leave", async () => {
    await handleRoomLeave(io, socket);
  });

  // Playback control
  socket.on("playback:play", async () => {
    await handlePlaybackPlay(io, socket);
  });

  socket.on("playback:pause", async () => {
    await handlePlaybackPause(io, socket);
  });

  socket.on("playback:seek", async (position) => {
    await handlePlaybackSeek(io, socket, position);
  });

  socket.on("playback:sync", async () => {
    await handlePlaybackSync(socket);
  });

  // Chat
  socket.on("chat:message", async (message) => {
    await handleChatMessage(io, socket, message);
  });

  socket.on("chat:request_history", async () => {
    await handleChatHistory(socket);
  });

  // Participant management
  socket.on("participant:grant_control", async (sessionId) => {
    await handleGrantControl(io, socket, sessionId);
  });

  socket.on("participant:revoke_control", async (sessionId) => {
    await handleRevokeControl(io, socket, sessionId);
  });

  socket.on("host:transfer", async (sessionId) => {
    await handleHostTransfer(io, socket, sessionId);
  });

  // Heartbeat
  socket.on("heartbeat", async () => {
    const sessionId = socketToSession.get(socket.id);
    if (sessionId) {
      await updateLastSeen(sessionId);
    }
  });

  // Disconnect
  socket.on("disconnect", async () => {
    await handleDisconnect(io, socket);
  });
}

/**
 * Handle room join
 */
async function handleRoomJoin(
  io: TypedServer,
  socket: TypedSocket,
  roomSlug: string,
  displayName: string,
  callback: (result: JoinResult) => void
): Promise<void> {
  try {
    // Get room
    const room = await getRoomBySlug(roomSlug);
    if (!room) {
      callback({ success: false, error: "Room not found" });
      return;
    }

    // Generate or reuse session ID
    const sessionId = socketToSession.get(socket.id) || randomBytes(32).toString("hex");

    // Add participant to database
    await dbJoinRoom(room.id, displayName, sessionId);

    // Track socket
    socketToSession.set(socket.id, sessionId);
    socketToRoom.set(socket.id, roomSlug);

    // Join Socket.io room
    await socket.join(roomSlug);

    // Get current playback state
    const playbackState: PlaybackState = {
      isPlaying: room.isPlaying,
      currentPosition: room.currentPosition,
      timestamp: room.lastUpdated.getTime(),
    };

    // Get all participants
    const participants = await getOnlineParticipants(room.id);
    const participantInfos: ParticipantInfo[] = participants.map((p) => ({
      sessionId: p.sessionId,
      displayName: p.displayName,
      isHost: p.isHost,
      canControl: p.canControl,
      isOnline: p.isOnline,
    }));

    // Broadcast updated participant list to all
    io.to(roomSlug).emit("participant:list", participantInfos);

    // Send success response to joiner
    callback({
      success: true,
      sessionId,
      room: {
        name: room.name,
        videoType: room.videoType,
        videoId: room.videoId,
        videoUrl: room.videoUrl || undefined,
        videoDuration: room.videoDuration || undefined,
        plexServerUrl: room.plexServerUrl || undefined,
      },
      playbackState,
      participants: participantInfos,
    });

    console.log(`[Socket] ${displayName} joined room ${roomSlug}`);
  } catch (error) {
    console.error("[Socket] Error joining room:", error);
    callback({ success: false, error: "Failed to join room" });
  }
}

/**
 * Handle room leave
 */
async function handleRoomLeave(io: TypedServer, socket: TypedSocket): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug) return;

  try {
    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    const wasHost = await isHost(sessionId);

    // Leave room in database
    await dbLeaveRoom(sessionId);

    // Remove from Socket.io room
    await socket.leave(roomSlug);

    // If this was the host, transfer to next participant
    if (wasHost) {
      const nextHost = await findNextHost(room.id, sessionId);

      if (nextHost) {
        // Transfer host
        await transferHost(room.id, nextHost.sessionId);

        // Find socket of new host
        const newHostSocketId = Array.from(socketToSession.entries())
          .find(([_, sid]) => sid === nextHost.sessionId)?.[0];

        if (newHostSocketId) {
          io.to(newHostSocketId).emit("you_are_host");
        }

        io.to(roomSlug).emit("host:changed", nextHost.sessionId);
      } else if (!room.isPersistent) {
        // No participants left in temporary room - delete it
        await deleteRoom(room.id);
        console.log(`[Socket] Temporary room ${roomSlug} deleted (no participants)`);
        return;
      }
    }

    // Broadcast updated participant list
    const participants = await getOnlineParticipants(room.id);
    const participantInfos: ParticipantInfo[] = participants.map((p) => ({
      sessionId: p.sessionId,
      displayName: p.displayName,
      isHost: p.isHost,
      canControl: p.canControl,
      isOnline: p.isOnline,
    }));

    io.to(roomSlug).emit("participant:list", participantInfos);

    console.log(`[Socket] Participant left room ${roomSlug}`);
  } catch (error) {
    console.error("[Socket] Error leaving room:", error);
  } finally {
    // Clean up tracking
    socketToSession.delete(socket.id);
    socketToRoom.delete(socket.id);
  }
}

/**
 * Handle playback play
 */
async function handlePlaybackPlay(io: TypedServer, socket: TypedSocket): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug) return;

  try {
    // Check permission
    if (!(await hasControlPermission(sessionId))) {
      socket.emit("error", "You don't have permission to control playback");
      return;
    }

    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    // Update database
    await updatePlaybackState(room.id, { isPlaying: true });

    // Broadcast to all participants
    const state: PlaybackState = {
      isPlaying: true,
      currentPosition: room.currentPosition,
      timestamp: Date.now(),
    };

    io.to(roomSlug).emit("playback:state", state);
  } catch (error) {
    console.error("[Socket] Error handling playback play:", error);
  }
}

/**
 * Handle playback pause
 */
async function handlePlaybackPause(io: TypedServer, socket: TypedSocket): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug) return;

  try {
    // Check permission
    if (!(await hasControlPermission(sessionId))) {
      socket.emit("error", "You don't have permission to control playback");
      return;
    }

    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    // Update database
    await updatePlaybackState(room.id, { isPlaying: false });

    // Broadcast to all participants
    const state: PlaybackState = {
      isPlaying: false,
      currentPosition: room.currentPosition,
      timestamp: Date.now(),
    };

    io.to(roomSlug).emit("playback:state", state);
  } catch (error) {
    console.error("[Socket] Error handling playback pause:", error);
  }
}

/**
 * Handle playback seek
 */
async function handlePlaybackSeek(
  io: TypedServer,
  socket: TypedSocket,
  position: number
): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug) return;

  try {
    // Check permission
    if (!(await hasControlPermission(sessionId))) {
      socket.emit("error", "You don't have permission to control playback");
      return;
    }

    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    // Update database
    await updatePlaybackState(room.id, { currentPosition: position });

    // Broadcast to all participants
    const state: PlaybackState = {
      isPlaying: room.isPlaying,
      currentPosition: position,
      timestamp: Date.now(),
    };

    io.to(roomSlug).emit("playback:state", state);
  } catch (error) {
    console.error("[Socket] Error handling playback seek:", error);
  }
}

/**
 * Handle playback sync request
 */
async function handlePlaybackSync(socket: TypedSocket): Promise<void> {
  const roomSlug = socketToRoom.get(socket.id);
  if (!roomSlug) return;

  try {
    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    const state: PlaybackState = {
      isPlaying: room.isPlaying,
      currentPosition: room.currentPosition,
      timestamp: room.lastUpdated.getTime(),
    };

    socket.emit("playback:state", state);
  } catch (error) {
    console.error("[Socket] Error handling playback sync:", error);
  }
}

/**
 * Handle chat message
 */
async function handleChatMessage(
  io: TypedServer,
  socket: TypedSocket,
  message: string
): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug || !message.trim()) return;

  try {
    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    // Get participant info
    const participant = room.participants.find((p) => p.sessionId === sessionId);
    if (!participant) return;

    // Create chat message
    const chatMessage: ChatMessage = {
      id: randomBytes(16).toString("hex"),
      displayName: participant.displayName,
      message: message.trim(),
      timestamp: Date.now(),
    };

    // Store in Redis if available
    if (isRedisConfigured()) {
      const chatKey = `chat:${room.id}`;

      try {
        const cached = await getCached<ChatMessage[]>(chatKey);
        const messages = cached || [];

        messages.push(chatMessage);

        // Keep last 100 messages
        if (messages.length > 100) {
          messages.shift();
        }

        // Store with TTL (24h for persistent rooms, 1h for temporary)
        const ttl = room.isPersistent ? 60 * 60 * 24 : 60 * 60;
        await setCached(chatKey, messages, ttl);
      } catch (error) {
        console.error("[Socket] Failed to cache chat message:", error);
      }
    }

    // Broadcast to all participants
    io.to(roomSlug).emit("chat:new", chatMessage);
  } catch (error) {
    console.error("[Socket] Error handling chat message:", error);
  }
}

/**
 * Handle chat history request
 */
async function handleChatHistory(socket: TypedSocket): Promise<void> {
  const roomSlug = socketToRoom.get(socket.id);
  if (!roomSlug) return;

  try {
    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    if (isRedisConfigured()) {
      const chatKey = `chat:${room.id}`;
      const messages = (await getCached<ChatMessage[]>(chatKey)) || [];
      socket.emit("chat:history", messages);
    } else {
      socket.emit("chat:history", []);
    }
  } catch (error) {
    console.error("[Socket] Error fetching chat history:", error);
    socket.emit("chat:history", []);
  }
}

/**
 * Handle grant control
 */
async function handleGrantControl(
  io: TypedServer,
  socket: TypedSocket,
  targetSessionId: string
): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug) return;

  try {
    // Check if requester is host
    if (!(await isHost(sessionId))) {
      socket.emit("error", "Only the host can grant control permissions");
      return;
    }

    // Grant control to target
    await grantControl(targetSessionId);

    // Find target socket and notify
    const targetSocketId = Array.from(socketToSession.entries())
      .find(([_, sid]) => sid === targetSessionId)?.[0];

    if (targetSocketId) {
      io.to(targetSocketId).emit("control:granted");
    }

    // Broadcast updated participant list
    const room = await getRoomBySlug(roomSlug);
    if (room) {
      const participants = await getOnlineParticipants(room.id);
      const participantInfos: ParticipantInfo[] = participants.map((p) => ({
        sessionId: p.sessionId,
        displayName: p.displayName,
        isHost: p.isHost,
        canControl: p.canControl,
        isOnline: p.isOnline,
      }));

      io.to(roomSlug).emit("participant:list", participantInfos);
    }
  } catch (error) {
    console.error("[Socket] Error granting control:", error);
  }
}

/**
 * Handle revoke control
 */
async function handleRevokeControl(
  io: TypedServer,
  socket: TypedSocket,
  targetSessionId: string
): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug) return;

  try {
    // Check if requester is host
    if (!(await isHost(sessionId))) {
      socket.emit("error", "Only the host can revoke control permissions");
      return;
    }

    // Revoke control from target
    await revokeControl(targetSessionId);

    // Find target socket and notify
    const targetSocketId = Array.from(socketToSession.entries())
      .find(([_, sid]) => sid === targetSessionId)?.[0];

    if (targetSocketId) {
      io.to(targetSocketId).emit("control:revoked");
    }

    // Broadcast updated participant list
    const room = await getRoomBySlug(roomSlug);
    if (room) {
      const participants = await getOnlineParticipants(room.id);
      const participantInfos: ParticipantInfo[] = participants.map((p) => ({
        sessionId: p.sessionId,
        displayName: p.displayName,
        isHost: p.isHost,
        canControl: p.canControl,
        isOnline: p.isOnline,
      }));

      io.to(roomSlug).emit("participant:list", participantInfos);
    }
  } catch (error) {
    console.error("[Socket] Error revoking control:", error);
  }
}

/**
 * Handle host transfer
 */
async function handleHostTransfer(
  io: TypedServer,
  socket: TypedSocket,
  targetSessionId: string
): Promise<void> {
  const sessionId = socketToSession.get(socket.id);
  const roomSlug = socketToRoom.get(socket.id);

  if (!sessionId || !roomSlug) return;

  try {
    // Check if requester is host
    if (!(await isHost(sessionId))) {
      socket.emit("error", "Only the host can transfer host status");
      return;
    }

    const room = await getRoomBySlug(roomSlug);
    if (!room) return;

    // Transfer host
    await transferHost(room.id, targetSessionId);

    // Find target socket and notify
    const targetSocketId = Array.from(socketToSession.entries())
      .find(([_, sid]) => sid === targetSessionId)?.[0];

    if (targetSocketId) {
      io.to(targetSocketId).emit("you_are_host");
    }

    // Broadcast host change to all
    io.to(roomSlug).emit("host:changed", targetSessionId);

    // Broadcast updated participant list
    const participants = await getOnlineParticipants(room.id);
    const participantInfos: ParticipantInfo[] = participants.map((p) => ({
      sessionId: p.sessionId,
      displayName: p.displayName,
      isHost: p.isHost,
      canControl: p.canControl,
      isOnline: p.isOnline,
    }));

    io.to(roomSlug).emit("participant:list", participantInfos);
  } catch (error) {
    console.error("[Socket] Error transferring host:", error);
  }
}

/**
 * Handle disconnect
 */
async function handleDisconnect(io: TypedServer, socket: TypedSocket): Promise<void> {
  await handleRoomLeave(io, socket);
}

/**
 * Room Management Utilities
 *
 * Handles watch party room operations including creation,
 * updates, cleanup, and room code generation.
 */

import { prisma } from "@/lib/db";
import type { Room, Participant } from "@prisma/client";

export interface CreateRoomParams {
  name: string;
  videoType: "youtube" | "plex";
  videoId: string;
  videoUrl?: string;
  videoDuration?: number;
  isPublic: boolean;
  isPersistent: boolean;
  hostDisplayName: string;
  plexServerUrl?: string;
  plexToken?: string;
  plexServerId?: string;
}

export interface RoomWithParticipants extends Room {
  participants: Participant[];
}

/**
 * Generate a unique URL-friendly slug from room name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50) +
    "-" +
    Math.random().toString(36).substring(2, 8);
}

/**
 * Generate a unique 6-character room code for private rooms
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid ambiguous chars (I,O,0,1)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new watch party room
 */
export async function createRoom(
  params: CreateRoomParams,
  hostSessionId: string
): Promise<RoomWithParticipants> {
  const slug = generateSlug(params.name);
  const roomCode = params.isPublic ? null : generateRoomCode();

  // Create room and host participant in a transaction
  const room = await prisma.$transaction(async (tx) => {
    const newRoom = await tx.room.create({
      data: {
        slug,
        name: params.name,
        roomCode,
        isPublic: params.isPublic,
        isPersistent: params.isPersistent,
        videoType: params.videoType,
        videoId: params.videoId,
        videoUrl: params.videoUrl,
        videoDuration: params.videoDuration,
        plexServerUrl: params.plexServerUrl,
        plexToken: params.plexToken,
        plexServerId: params.plexServerId,
        isPlaying: false,
        currentPosition: 0,
        hostId: hostSessionId,
      },
      include: {
        participants: true,
      },
    });

    // Create host participant
    await tx.participant.create({
      data: {
        roomId: newRoom.id,
        displayName: params.hostDisplayName,
        sessionId: hostSessionId,
        isHost: true,
        canControl: true,
        isOnline: true,
      },
    });

    // Fetch room with participants
    return tx.room.findUnique({
      where: { id: newRoom.id },
      include: { participants: true },
    });
  });

  if (!room) {
    throw new Error("Failed to create room");
  }

  return room;
}

/**
 * Get room by slug with participants
 */
export async function getRoomBySlug(
  slug: string
): Promise<RoomWithParticipants | null> {
  return prisma.room.findUnique({
    where: { slug },
    include: {
      participants: {
        orderBy: { joinedAt: "asc" },
      },
    },
  });
}

/**
 * Get room by room code (for private rooms)
 */
export async function getRoomByCode(
  roomCode: string
): Promise<RoomWithParticipants | null> {
  return prisma.room.findUnique({
    where: { roomCode },
    include: {
      participants: {
        orderBy: { joinedAt: "asc" },
      },
    },
  });
}

/**
 * List all public rooms
 */
export async function listPublicRooms(): Promise<RoomWithParticipants[]> {
  return prisma.room.findMany({
    where: { isPublic: true },
    include: {
      participants: {
        where: { isOnline: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Update room playback state
 */
export async function updatePlaybackState(
  roomId: string,
  state: {
    isPlaying?: boolean;
    currentPosition?: number;
  }
): Promise<Room> {
  return prisma.room.update({
    where: { id: roomId },
    data: {
      ...state,
      lastUpdated: new Date(),
    },
  });
}

/**
 * Transfer host to another participant
 * Returns the new host participant
 */
export async function transferHost(
  roomId: string,
  newHostSessionId: string
): Promise<Participant> {
  return prisma.$transaction(async (tx) => {
    // Remove host status from current host
    await tx.participant.updateMany({
      where: { roomId, isHost: true },
      data: { isHost: false },
    });

    // Set new host
    const newHost = await tx.participant.update({
      where: { sessionId: newHostSessionId },
      data: {
        isHost: true,
        canControl: true,
      },
    });

    // Update room's hostId
    await tx.room.update({
      where: { id: roomId },
      data: { hostId: newHostSessionId },
    });

    return newHost;
  });
}

/**
 * Find next host when current host leaves
 * Priority: co-hosts first, then oldest participant
 */
export async function findNextHost(
  roomId: string,
  excludeSessionId: string
): Promise<Participant | null> {
  // Try to find a co-host first
  let nextHost = await prisma.participant.findFirst({
    where: {
      roomId,
      sessionId: { not: excludeSessionId },
      canControl: true,
      isOnline: true,
    },
    orderBy: { joinedAt: "asc" },
  });

  // If no co-host, find oldest participant
  if (!nextHost) {
    nextHost = await prisma.participant.findFirst({
      where: {
        roomId,
        sessionId: { not: excludeSessionId },
        isOnline: true,
      },
      orderBy: { joinedAt: "asc" },
    });
  }

  return nextHost;
}

/**
 * Delete a room and all associated participants
 */
export async function deleteRoom(roomId: string): Promise<void> {
  await prisma.room.delete({
    where: { id: roomId },
  });
}

/**
 * Clean up temporary rooms that have been empty for too long
 * Should be called periodically (e.g., every 5 minutes)
 */
export async function cleanupAbandonedRooms(
  graceMinutes: number = 30
): Promise<number> {
  const cutoffTime = new Date(Date.now() - graceMinutes * 60 * 1000);

  // Find temporary rooms with no online participants
  const abandonedRooms = await prisma.room.findMany({
    where: {
      isPersistent: false,
      updatedAt: { lt: cutoffTime },
      participants: {
        none: {
          isOnline: true,
        },
      },
    },
    select: { id: true },
  });

  // Delete abandoned rooms
  if (abandonedRooms.length > 0) {
    await prisma.room.deleteMany({
      where: {
        id: {
          in: abandonedRooms.map((r) => r.id),
        },
      },
    });
  }

  return abandonedRooms.length;
}

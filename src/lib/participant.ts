/**
 * Participant Management Utilities
 *
 * Handles watch party participant operations including
 * joining, leaving, permission management, and online status.
 */

import { prisma } from "@/lib/db";
import type { Participant } from "@prisma/client";
import { randomBytes } from "crypto";

/**
 * Generate a unique session ID for a participant
 */
export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Add a participant to a room
 */
export async function joinRoom(
  roomId: string,
  displayName: string,
  sessionId?: string
): Promise<Participant> {
  const sid = sessionId || generateSessionId();

  // Check if participant already exists (reconnection)
  const existing = await prisma.participant.findUnique({
    where: { sessionId: sid },
  });

  if (existing) {
    // Update existing participant to be online
    return prisma.participant.update({
      where: { sessionId: sid },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
        displayName, // Allow display name change on rejoin
      },
    });
  }

  // Create new participant
  return prisma.participant.create({
    data: {
      roomId,
      displayName,
      sessionId: sid,
      isHost: false,
      canControl: false,
      isOnline: true,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Remove a participant from a room
 */
export async function leaveRoom(sessionId: string): Promise<Participant | null> {
  try {
    return await prisma.participant.update({
      where: { sessionId },
      data: {
        isOnline: false,
        lastSeenAt: new Date(),
      },
    });
  } catch {
    return null;
  }
}

/**
 * Update participant's last seen timestamp
 */
export async function updateLastSeen(sessionId: string): Promise<void> {
  await prisma.participant.updateMany({
    where: { sessionId },
    data: { lastSeenAt: new Date() },
  });
}

/**
 * Grant co-host permission to a participant
 */
export async function grantControl(
  sessionId: string
): Promise<Participant> {
  return prisma.participant.update({
    where: { sessionId },
    data: { canControl: true },
  });
}

/**
 * Revoke co-host permission from a participant
 */
export async function revokeControl(
  sessionId: string
): Promise<Participant> {
  return prisma.participant.update({
    where: { sessionId },
    data: { canControl: false },
  });
}

/**
 * Get all online participants in a room
 */
export async function getOnlineParticipants(
  roomId: string
): Promise<Participant[]> {
  return prisma.participant.findMany({
    where: {
      roomId,
      isOnline: true,
    },
    orderBy: { joinedAt: "asc" },
  });
}

/**
 * Get participant by session ID
 */
export async function getParticipant(
  sessionId: string
): Promise<Participant | null> {
  return prisma.participant.findUnique({
    where: { sessionId },
  });
}

/**
 * Check if a participant has control permissions (host or co-host)
 */
export async function hasControlPermission(
  sessionId: string
): Promise<boolean> {
  const participant = await prisma.participant.findUnique({
    where: { sessionId },
    select: { isHost: true, canControl: true },
  });

  return participant ? (participant.isHost || participant.canControl) : false;
}

/**
 * Check if a participant is the host
 */
export async function isHost(sessionId: string): Promise<boolean> {
  const participant = await prisma.participant.findUnique({
    where: { sessionId },
    select: { isHost: true },
  });

  return participant?.isHost || false;
}

/**
 * Get the host of a room
 */
export async function getRoomHost(roomId: string): Promise<Participant | null> {
  return prisma.participant.findFirst({
    where: {
      roomId,
      isHost: true,
    },
  });
}

/**
 * Mark participants as offline if they haven't been seen in a while
 * Should be called periodically (e.g., every minute)
 */
export async function markStaleParticipantsOffline(
  staleMinutes: number = 2
): Promise<number> {
  const cutoffTime = new Date(Date.now() - staleMinutes * 60 * 1000);

  const result = await prisma.participant.updateMany({
    where: {
      isOnline: true,
      lastSeenAt: { lt: cutoffTime },
    },
    data: {
      isOnline: false,
    },
  });

  return result.count;
}

/**
 * Delete participants from temporary rooms that have been offline for too long
 */
export async function cleanupOfflineParticipants(
  offlineHours: number = 24
): Promise<number> {
  const cutoffTime = new Date(Date.now() - offlineHours * 60 * 60 * 1000);

  // Only delete from temporary rooms
  const result = await prisma.participant.deleteMany({
    where: {
      isOnline: false,
      lastSeenAt: { lt: cutoffTime },
      room: {
        isPersistent: false,
      },
    },
  });

  return result.count;
}

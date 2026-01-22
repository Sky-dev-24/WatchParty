/**
 * Room Detail API
 *
 * GET /api/rooms/[slug] - Get room details
 * PATCH /api/rooms/[slug] - Update room (admin or host only)
 * DELETE /api/rooms/[slug] - Delete room (admin or host only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRoomBySlug, deleteRoom } from "@/lib/room";
import { getAdminSessionId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isHost } from "@/lib/participant";

/**
 * GET /api/rooms/[slug]
 * Get room details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const room = await getRoomBySlug(params.slug);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Don't expose sensitive info
    return NextResponse.json({
      room: {
        slug: room.slug,
        name: room.name,
        videoType: room.videoType,
        videoId: room.videoId,
        videoUrl: room.videoUrl,
        videoDuration: room.videoDuration,
        isPublic: room.isPublic,
        isPersistent: room.isPersistent,
        isPlaying: room.isPlaying,
        currentPosition: room.currentPosition,
        participantCount: room.participants.filter((p) => p.isOnline).length,
        createdAt: room.createdAt,
        // Don't expose: plexToken, plexServerUrl (security)
      },
    });
  } catch (error) {
    console.error("[API] Failed to get room:", error);
    return NextResponse.json(
      { error: "Failed to get room" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rooms/[slug]
 * Update room settings (admin or host only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const sessionId = await getAdminSessionId(request);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const room = await getRoomBySlug(params.slug);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if user is host
    const userIsHost = await isHost(sessionId);

    if (!userIsHost && room.hostId !== sessionId) {
      return NextResponse.json(
        { error: "Only the host can update this room" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, isPublic } = body;

    // Update room
    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: {
        ...(name && { name }),
        ...(typeof isPublic === "boolean" && { isPublic }),
      },
    });

    return NextResponse.json({
      room: {
        slug: updatedRoom.slug,
        name: updatedRoom.name,
        isPublic: updatedRoom.isPublic,
      },
    });
  } catch (error) {
    console.error("[API] Failed to update room:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rooms/[slug]
 * Delete room (admin or host only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const sessionId = await getAdminSessionId(request);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const room = await getRoomBySlug(params.slug);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if user is host
    const userIsHost = await isHost(sessionId);

    if (!userIsHost && room.hostId !== sessionId) {
      return NextResponse.json(
        { error: "Only the host can delete this room" },
        { status: 403 }
      );
    }

    // Delete room
    await deleteRoom(room.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete room:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}

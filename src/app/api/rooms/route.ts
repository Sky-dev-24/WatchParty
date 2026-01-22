/**
 * Rooms API - List and Create
 *
 * GET /api/rooms - List public rooms
 * POST /api/rooms - Create new room (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createRoom, listPublicRooms } from "@/lib/room";
import { getAdminSessionId } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/rooms
 * List all public rooms
 */
export async function GET(request: NextRequest) {
  try {
    const rooms = await listPublicRooms();

    // Format response with participant counts
    const formatted = rooms.map((room) => ({
      slug: room.slug,
      name: room.name,
      videoType: room.videoType,
      isPublic: room.isPublic,
      isPersistent: room.isPersistent,
      isPlaying: room.isPlaying,
      participantCount: room.participants.length,
      createdAt: room.createdAt,
    }));

    return NextResponse.json({ rooms: formatted });
  } catch (error) {
    console.error("[API] Failed to list rooms:", error);
    return NextResponse.json(
      { error: "Failed to list rooms" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rooms
 * Create a new room (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const sessionId = await getAdminSessionId(request);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Admin authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      name,
      videoType,
      videoId,
      videoUrl,
      videoDuration,
      isPublic,
      isPersistent,
      hostDisplayName,
      plexServerUrl,
      plexServerId,
    } = body;

    // Validation
    if (!name || !videoType || !videoId || !hostDisplayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (videoType !== "youtube" && videoType !== "plex") {
      return NextResponse.json(
        { error: "Invalid videoType. Must be 'youtube' or 'plex'" },
        { status: 400 }
      );
    }

    // If Plex, get token from stored connection
    let plexToken = undefined;
    if (videoType === "plex") {
      const connection = await prisma.plexConnection.findUnique({
        where: { sessionId },
      });

      if (!connection) {
        return NextResponse.json(
          { error: "Plex authentication required for Plex videos" },
          { status: 400 }
        );
      }

      plexToken = connection.plexToken;

      if (!plexServerUrl) {
        return NextResponse.json(
          { error: "plexServerUrl required for Plex videos" },
          { status: 400 }
        );
      }
    }

    // Create room
    const room = await createRoom(
      {
        name,
        videoType,
        videoId,
        videoUrl,
        videoDuration,
        isPublic: isPublic ?? true,
        isPersistent: isPersistent ?? false,
        hostDisplayName,
        plexServerUrl,
        plexToken,
        plexServerId,
      },
      sessionId
    );

    return NextResponse.json(
      {
        room: {
          id: room.id,
          slug: room.slug,
          name: room.name,
          roomCode: room.roomCode,
          videoType: room.videoType,
          isPublic: room.isPublic,
          isPersistent: room.isPersistent,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Failed to create room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}

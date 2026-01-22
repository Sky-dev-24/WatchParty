/**
 * Room Join API
 *
 * POST /api/rooms/join
 * Join a room using room code (for private rooms)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode, getRoomBySlug } from "@/lib/room";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomCode, slug } = body;

    if (!roomCode && !slug) {
      return NextResponse.json(
        { error: "Either roomCode or slug is required" },
        { status: 400 }
      );
    }

    // Find room
    let room = null;

    if (roomCode) {
      room = await getRoomByCode(roomCode);
    } else if (slug) {
      room = await getRoomBySlug(slug);
    }

    if (!room) {
      return NextResponse.json(
        { error: "Room not found. Check your room code." },
        { status: 404 }
      );
    }

    // Return room slug for navigation
    return NextResponse.json({
      slug: room.slug,
      name: room.name,
      isPublic: room.isPublic,
    });
  } catch (error) {
    console.error("[API] Failed to join room:", error);
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }
}

/**
 * Plex Authentication - Check PIN Status
 *
 * GET /api/plex/auth/check?pinId=123
 * Checks if PIN has been authorized and returns auth token
 */

import { NextRequest, NextResponse } from "next/server";
import { checkPlexPinStatus, getPlexUser } from "@/lib/plex-auth";
import { prisma } from "@/lib/db";
import { getAdminSessionId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pinId = searchParams.get("pinId");

    if (!pinId) {
      return NextResponse.json({ error: "Missing pinId parameter" }, { status: 400 });
    }

    // Check PIN status
    const pin = await checkPlexPinStatus(parseInt(pinId));

    // If not authorized yet, return pending status
    if (!pin.authToken) {
      return NextResponse.json({
        authorized: false,
        expiresAt: pin.expiresAt,
      });
    }

    // Get user info
    const user = await getPlexUser(pin.authToken);

    // Get admin session ID from cookies
    const sessionId = await getAdminSessionId(request);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Admin session required" },
        { status: 401 }
      );
    }

    // Store Plex connection in database
    await prisma.plexConnection.upsert({
      where: { sessionId },
      create: {
        sessionId,
        plexToken: pin.authToken,
        plexUsername: user.username,
        expiresAt: new Date(pin.expiresAt),
      },
      update: {
        plexToken: pin.authToken,
        plexUsername: user.username,
        expiresAt: new Date(pin.expiresAt),
      },
    });

    return NextResponse.json({
      authorized: true,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error("[API] Failed to check Plex PIN:", error);
    return NextResponse.json(
      { error: "Failed to check PIN status" },
      { status: 500 }
    );
  }
}

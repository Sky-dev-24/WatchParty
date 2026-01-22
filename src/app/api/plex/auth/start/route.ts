/**
 * Plex Authentication - Start OAuth Flow
 *
 * POST /api/plex/auth/start
 * Initiates Plex PIN-based OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { requestPlexPin, getPlexAuthUrl } from "@/lib/plex-auth";

export async function POST(request: NextRequest) {
  try {
    // Request a PIN from Plex
    const pin = await requestPlexPin();

    // Generate auth URL for user
    const authUrl = getPlexAuthUrl(pin);

    return NextResponse.json({
      pinId: pin.id,
      code: pin.code,
      authUrl,
      expiresAt: pin.expiresAt,
    });
  } catch (error) {
    console.error("[API] Failed to start Plex auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Plex authentication" },
      { status: 500 }
    );
  }
}

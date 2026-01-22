/**
 * Plex Video Playback API
 *
 * GET /api/plex/video/[ratingKey]?serverUrl=...&token=...
 * Returns playback URL for a specific video
 */

import { NextRequest, NextResponse } from "next/server";
import { getVideoPlaybackUrl } from "@/lib/plex";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ratingKey: string }> }
) {
  try {
    const { ratingKey } = await params;
    const searchParams = request.nextUrl.searchParams;
    const serverUrl = searchParams.get("serverUrl");
    const token = searchParams.get("token");

    if (!serverUrl || !token) {
      return NextResponse.json(
        { error: "Missing serverUrl or token parameter" },
        { status: 400 }
      );
    }

    // Generate playback URL
    const url = getVideoPlaybackUrl(serverUrl, token, ratingKey, {
      transcode: true,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[API] Failed to get video playback URL:", error);
    return NextResponse.json(
      { error: "Failed to get playback URL" },
      { status: 500 }
    );
  }
}

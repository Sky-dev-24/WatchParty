/**
 * Plex Library Videos API
 *
 * GET /api/plex/library/[id]/videos?serverUrl=...
 * Returns videos from a specific library
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchLibraryVideos, formatPlexDuration, getPlexThumbnail } from "@/lib/plex";
import { prisma } from "@/lib/db";
import { getAdminSessionId } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const serverUrl = searchParams.get("serverUrl");

    if (!serverUrl) {
      return NextResponse.json(
        { error: "Missing serverUrl parameter" },
        { status: 400 }
      );
    }

    // Get admin session
    const sessionId = await getAdminSessionId(request);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get Plex connection
    const connection = await prisma.plexConnection.findUnique({
      where: { sessionId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Plex not connected" },
        { status: 400 }
      );
    }

    // Fetch videos
    const videos = await fetchLibraryVideos(
      serverUrl,
      connection.plexToken,
      libraryId
    );

    // Format response
    const formatted = videos.map((video) => ({
      ratingKey: video.ratingKey,
      title: video.title,
      year: video.year,
      summary: video.summary,
      duration: formatPlexDuration(video.duration),
      thumb: video.thumb
        ? getPlexThumbnail(serverUrl, connection.plexToken, video.thumb)
        : undefined,
      type: video.type,
    }));

    return NextResponse.json({ videos: formatted });
  } catch (error) {
    console.error("[API] Failed to fetch library videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}

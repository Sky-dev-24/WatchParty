/**
 * Plex Libraries API
 *
 * GET /api/plex/libraries?serverUrl=...
 * Returns list of libraries from a specific Plex server
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchServerLibraries } from "@/lib/plex";
import { prisma } from "@/lib/db";
import { getAdminSessionId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
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

    // Fetch libraries
    const libraries = await fetchServerLibraries(
      serverUrl,
      connection.plexToken
    );

    // Filter to only video libraries (movies and TV shows)
    const videoLibraries = libraries.filter(
      (lib) => lib.type === "movie" || lib.type === "show"
    );

    return NextResponse.json({ libraries: videoLibraries });
  } catch (error) {
    console.error("[API] Failed to fetch Plex libraries:", error);
    return NextResponse.json(
      { error: "Failed to fetch libraries" },
      { status: 500 }
    );
  }
}

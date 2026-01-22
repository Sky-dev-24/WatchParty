/**
 * Plex Servers API
 *
 * GET /api/plex/servers
 * Returns list of user's accessible Plex servers
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchUserServers, getBestServerUrl } from "@/lib/plex";
import { prisma } from "@/lib/db";
import { getAdminSessionId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
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
        { error: "Plex not connected. Please authenticate first." },
        { status: 400 }
      );
    }

    // Fetch servers
    const servers = await fetchUserServers(connection.plexToken);

    // Format response
    const formatted = servers.map((server) => ({
      name: server.name,
      machineIdentifier: server.machineIdentifier,
      url: getBestServerUrl(server),
      version: server.version,
      platform: server.platform,
      owned: server.owned,
    }));

    return NextResponse.json({ servers: formatted });
  } catch (error) {
    console.error("[API] Failed to fetch Plex servers:", error);
    return NextResponse.json(
      { error: "Failed to fetch servers" },
      { status: 500 }
    );
  }
}

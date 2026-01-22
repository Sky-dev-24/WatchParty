/**
 * Plex API Client
 *
 * Wrapper for Plex API operations used in watch party.
 * Handles server communication and data formatting.
 */

import {
  getPlexServers,
  getPlexLibraries,
  getPlexLibraryContent,
  getPlexVideoUrl,
  type PlexServer,
  type PlexLibrary,
  type PlexVideo,
} from "./plex-auth";

/**
 * Find the best connection URL for a Plex server
 * Prioritizes local connections over relay
 */
export function getBestServerUrl(server: PlexServer): string {
  if (!server.connections || server.connections.length === 0) {
    return `${server.protocol}://${server.address}:${server.port}`;
  }

  // Prefer local, non-relay connections
  const localConnection = server.connections.find((c) => c.local && !c.relay);
  if (localConnection) {
    return localConnection.uri;
  }

  // Fall back to any non-relay connection
  const nonRelayConnection = server.connections.find((c) => !c.relay);
  if (nonRelayConnection) {
    return nonRelayConnection.uri;
  }

  // Last resort: use any connection
  return server.connections[0].uri;
}

/**
 * Get all accessible Plex servers for a user
 */
export async function fetchUserServers(authToken: string): Promise<PlexServer[]> {
  return getPlexServers(authToken);
}

/**
 * Get libraries from a specific server
 */
export async function fetchServerLibraries(
  serverUrl: string,
  authToken: string
): Promise<PlexLibrary[]> {
  return getPlexLibraries(serverUrl, authToken);
}

/**
 * Get videos from a library
 * Filters to only return video content (movies, episodes)
 */
export async function fetchLibraryVideos(
  serverUrl: string,
  authToken: string,
  libraryKey: string
): Promise<PlexVideo[]> {
  const content = await getPlexLibraryContent(serverUrl, authToken, libraryKey);

  // Filter to only video types
  return content.filter((item) => item.type === "movie" || item.type === "episode");
}

/**
 * Get playback URL for a video
 */
export function getVideoPlaybackUrl(
  serverUrl: string,
  authToken: string,
  ratingKey: string,
  options: {
    transcode?: boolean;
    quality?: "original" | "1080p" | "720p" | "480p";
  } = {}
): string {
  const { transcode = true } = options;
  return getPlexVideoUrl(serverUrl, authToken, ratingKey, transcode);
}

/**
 * Format video duration from milliseconds to seconds
 */
export function formatPlexDuration(durationMs: number): number {
  return Math.floor(durationMs / 1000);
}

/**
 * Get thumbnail URL for a video
 */
export function getPlexThumbnail(
  serverUrl: string,
  authToken: string,
  thumbPath: string
): string {
  if (!thumbPath) return "";
  return `${serverUrl}${thumbPath}?X-Plex-Token=${authToken}`;
}

/**
 * Test connection to a Plex server
 */
export async function testServerConnection(
  serverUrl: string,
  authToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl}/?X-Plex-Token=${authToken}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("[Plex] Connection test failed:", error);
    return false;
  }
}

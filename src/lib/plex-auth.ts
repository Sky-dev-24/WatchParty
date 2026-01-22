/**
 * Plex OAuth Authentication
 *
 * Implements Plex PIN-based OAuth 2.0 flow for user authentication.
 * https://forums.plex.tv/t/authenticating-with-plex/609370
 */

export interface PlexAuthPin {
  id: number;
  code: string;
  product: string;
  trusted: boolean;
  clientIdentifier: string;
  location: {
    code: string;
    european_union_member: boolean;
    continent_code: string;
    country: string;
    city: string;
    time_zone: string;
    postal_code: string;
    in_privacy_restricted_country: boolean;
    subdivisions: string;
    coordinates: string;
  };
  expiresIn: number;
  createdAt: string;
  expiresAt: string;
  authToken: string | null;
  newRegistration: boolean | null;
}

export interface PlexUser {
  id: number;
  uuid: string;
  email: string;
  joined_at: string;
  username: string;
  title: string;
  thumb: string;
  hasPassword: boolean;
  authToken: string;
  subscription: {
    active: boolean;
    status: string;
    plan: string;
    features: string[];
  };
}

export interface PlexServer {
  name: string;
  host: string;
  address: string;
  port: number;
  machineIdentifier: string;
  version: string;
  product: string;
  productVersion: string;
  platform: string;
  platformVersion: string;
  device: string;
  protocol: string;
  connections: PlexConnection[];
  owned: boolean;
  accessToken?: string;
}

export interface PlexConnection {
  protocol: string;
  address: string;
  port: number;
  uri: string;
  local: boolean;
  relay: boolean;
}

const PLEX_CLIENT_IDENTIFIER = process.env.NEXT_PUBLIC_PLEX_CLIENT_ID || "watchparty-app";
const PLEX_PRODUCT_NAME = "WatchParty";
const PLEX_PRODUCT_VERSION = "1.0.0";

/**
 * Generate Plex API headers
 */
function getPlexHeaders(authToken?: string): HeadersInit {
  const headers: HeadersInit = {
    "X-Plex-Product": PLEX_PRODUCT_NAME,
    "X-Plex-Version": PLEX_PRODUCT_VERSION,
    "X-Plex-Client-Identifier": PLEX_CLIENT_IDENTIFIER,
    "X-Plex-Platform": "Web",
    "X-Plex-Platform-Version": "1.0",
    "X-Plex-Device": "Browser",
    "X-Plex-Device-Name": "WatchParty",
    Accept: "application/json",
  };

  if (authToken) {
    headers["X-Plex-Token"] = authToken;
  }

  return headers;
}

/**
 * Step 1: Request a PIN from Plex for OAuth authentication
 */
export async function requestPlexPin(): Promise<PlexAuthPin> {
  const response = await fetch("https://plex.tv/api/v2/pins?strong=true", {
    method: "POST",
    headers: getPlexHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to request Plex PIN");
  }

  const data = await response.json();
  return data;
}

/**
 * Step 2: Check if PIN has been authorized (poll this)
 */
export async function checkPlexPinStatus(pinId: number): Promise<PlexAuthPin> {
  const response = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
    method: "GET",
    headers: getPlexHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to check PIN status");
  }

  const data = await response.json();
  return data;
}

/**
 * Get Plex auth URL for user to authorize
 */
export function getPlexAuthUrl(pin: PlexAuthPin): string {
  const params = new URLSearchParams({
    clientID: pin.clientIdentifier || PLEX_CLIENT_IDENTIFIER,
    code: pin.code,
    "context[device][product]": PLEX_PRODUCT_NAME,
    "context[device][version]": PLEX_PRODUCT_VERSION,
  });

  return `https://app.plex.tv/auth#?${params.toString()}`;
}

/**
 * Get user information from Plex
 */
export async function getPlexUser(authToken: string): Promise<PlexUser> {
  const response = await fetch("https://plex.tv/api/v2/user", {
    method: "GET",
    headers: getPlexHeaders(authToken),
  });

  if (!response.ok) {
    throw new Error("Failed to get Plex user");
  }

  const data = await response.json();
  return data;
}

/**
 * Get user's Plex servers
 */
export async function getPlexServers(authToken: string): Promise<PlexServer[]> {
  const response = await fetch("https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1", {
    method: "GET",
    headers: getPlexHeaders(authToken),
  });

  if (!response.ok) {
    throw new Error("Failed to get Plex servers");
  }

  const data = await response.json();

  // Filter for Server devices only
  const servers = data.filter(
    (resource: { product: string; provides: string }) =>
      resource.product === "Plex Media Server" && resource.provides.includes("server")
  );

  return servers;
}

/**
 * Get library sections from a Plex server
 */
export async function getPlexLibraries(
  serverUrl: string,
  authToken: string
): Promise<PlexLibrary[]> {
  const response = await fetch(`${serverUrl}/library/sections`, {
    method: "GET",
    headers: getPlexHeaders(authToken),
  });

  if (!response.ok) {
    throw new Error("Failed to get Plex libraries");
  }

  const data = await response.json();
  return data.MediaContainer.Directory || [];
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string; // "movie", "show", "artist", "photo"
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  updatedAt: number;
  createdAt: number;
  scannedAt: number;
  art: string;
  thumb: string;
  Location: Array<{ id: number; path: string }>;
}

/**
 * Get videos from a library section
 */
export async function getPlexLibraryContent(
  serverUrl: string,
  authToken: string,
  libraryKey: string
): Promise<PlexVideo[]> {
  const response = await fetch(`${serverUrl}/library/sections/${libraryKey}/all`, {
    method: "GET",
    headers: getPlexHeaders(authToken),
  });

  if (!response.ok) {
    throw new Error("Failed to get library content");
  }

  const data = await response.json();
  return data.MediaContainer.Metadata || [];
}

export interface PlexVideo {
  ratingKey: string;
  key: string;
  guid: string;
  studio?: string;
  type: string; // "movie", "episode", etc.
  title: string;
  contentRating?: string;
  summary?: string;
  rating?: number;
  year?: number;
  thumb?: string;
  art?: string;
  duration: number; // milliseconds
  originallyAvailableAt?: string;
  addedAt: number;
  updatedAt: number;
  Media?: Array<{
    id: number;
    duration: number;
    bitrate: number;
    width: number;
    height: number;
    aspectRatio: number;
    videoCodec: string;
    videoResolution: string;
    container: string;
    videoFrameRate: string;
    Part: Array<{
      id: number;
      key: string;
      duration: number;
      file: string;
      size: number;
      container: string;
    }>;
  }>;
}

/**
 * Get video playback URL
 */
export function getPlexVideoUrl(
  serverUrl: string,
  authToken: string,
  ratingKey: string,
  transcode: boolean = true,
  identifiers?: {
    clientIdentifier?: string;
    sessionIdentifier?: string;
  }
): string {
  const clientIdentifier = identifiers?.clientIdentifier || PLEX_CLIENT_IDENTIFIER;
  const sessionIdentifier = identifiers?.sessionIdentifier;

  if (transcode) {
    // Use universal transcoder
    const params = new URLSearchParams({
      path: `/library/metadata/${ratingKey}`,
      mediaIndex: "0",
      partIndex: "0",
      protocol: "hls",
      fastSeek: "1",
      directPlay: "0",
      directStream: "1",
      subtitleSize: "100",
      audioBoost: "100",
      location: "lan",
      "X-Plex-Platform": "Chrome",
      "X-Plex-Client-Identifier": clientIdentifier,
      "X-Plex-Token": authToken,
    });

    if (sessionIdentifier) {
      params.set("X-Plex-Session-Identifier", sessionIdentifier);
      params.set("session", sessionIdentifier);
    }

    return `${serverUrl}/video/:/transcode/universal/start.m3u8?${params.toString()}`;
  } else {
    // Direct play
    const params = new URLSearchParams({
      "X-Plex-Token": authToken,
      "X-Plex-Client-Identifier": clientIdentifier,
    });

    if (sessionIdentifier) {
      params.set("X-Plex-Session-Identifier", sessionIdentifier);
      params.set("session", sessionIdentifier);
    }

    return `${serverUrl}/library/metadata/${ratingKey}?${params.toString()}`;
  }
}

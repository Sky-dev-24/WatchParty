// API Helper Functions for E2E Tests

import { request, type APIRequestContext } from '@playwright/test';
import { config, endpoints } from './config';
import type {
  Stream,
  HealthCheckResponse,
  StreamStatusResponse,
  LoginResponse,
  AuditLogResponse,
  MuxAsset,
} from './types';

let apiContext: APIRequestContext | null = null;
let sessionCookie: string | null = null;

export async function getApiContext(): Promise<APIRequestContext> {
  if (!apiContext) {
    apiContext = await request.newContext({
      baseURL: config.baseUrl,
    });
  }
  return apiContext;
}

export async function disposeApiContext(): Promise<void> {
  if (apiContext) {
    await apiContext.dispose();
    apiContext = null;
  }
  sessionCookie = null;
}

// Health Check
export async function checkHealth(): Promise<HealthCheckResponse> {
  const api = await getApiContext();
  const response = await api.get(endpoints.api.health);
  return response.json();
}

// Authentication
export async function login(password: string = config.adminPassword): Promise<LoginResponse & { cookie?: string }> {
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not set');
  }
  sessionCookie = null;
  const api = await getApiContext();
  const response = await api.post(endpoints.api.login, {
    data: { password },
    headers: { 'Content-Type': 'application/json' },
  });

  const setCookie = response.headers()['set-cookie'];

  let result: LoginResponse;
  try {
    result = await response.json();
  } catch (error) {
    result = { success: false, error: 'Invalid login response' };
  }

  if (response.status() >= 400 || !result.success) {
    const message = result.error || `Login failed with status ${response.status()}`;
    throw new Error(message);
  }

  if (setCookie) {
    sessionCookie = setCookie;
  }

  return { ...result, cookie: setCookie };
}

export async function logout(): Promise<void> {
  const api = await getApiContext();
  await api.post(endpoints.api.logout, {
    headers: sessionCookie ? { Cookie: sessionCookie } : {},
  });
  sessionCookie = null;
}

export function getSessionCookie(): string | null {
  return sessionCookie;
}

export function setSessionCookie(cookie: string): void {
  sessionCookie = cookie;
}

function normalizeStream(stream: Stream | null): Stream | null {
  if (!stream) return stream;
  if (!stream.playlistItems && stream.items) {
    return { ...stream, playlistItems: stream.items };
  }
  return stream;
}

function normalizeStreams(streams: Stream[]): Stream[] {
  return streams.map((stream) => normalizeStream(stream) as Stream);
}

// Streams
export async function getStreams(): Promise<{ streams: Stream[]; cached: boolean }> {
  const api = await getApiContext();
  const response = await api.get(endpoints.api.streams);
  const streams = normalizeStreams(await response.json());
  const cached = response.headers()['x-cache'] === 'HIT';
  return { streams, cached };
}

export async function getStream(idOrSlug: string): Promise<Stream | null> {
  const api = await getApiContext();
  const response = await api.get(endpoints.api.stream(idOrSlug));
  if (response.status() === 404) return null;
  return normalizeStream(await response.json());
}

export async function createStream(data: {
  title: string;
  slug: string;
  assetIds: string[];
  scheduledStart: string;
  loopCount?: number;
  syncInterval?: number;
  driftTolerance?: number;
}): Promise<{ stream?: Stream; error?: string; status: number }> {
  const api = await getApiContext();
  const response = await api.post(endpoints.api.streams, {
    data,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
  });

  const status = response.status();
  if (status >= 400) {
    const error = await response.json();
    return { error: error.error || error.message, status };
  }

  return { stream: normalizeStream(await response.json()) || undefined, status };
}

export async function updateStream(
  id: string,
  data: Partial<{
    title: string;
    slug: string;
    scheduledStart: string;
    isActive: boolean;
    endedAt: string | null;
    loopCount: number;
    assetIds: string[];
  }>
): Promise<{ stream?: Stream; error?: string; status: number }> {
  const api = await getApiContext();
  const response = await api.patch(endpoints.api.stream(id), {
    data,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
  });

  const status = response.status();
  if (status >= 400) {
    const error = await response.json();
    return { error: error.error || error.message, status };
  }

  return { stream: normalizeStream(await response.json()) || undefined, status };
}

export async function deleteStream(id: string): Promise<{ success: boolean; status: number }> {
  const api = await getApiContext();
  const response = await api.delete(endpoints.api.stream(id), {
    headers: sessionCookie ? { Cookie: sessionCookie } : {},
  });

  return { success: response.status() < 400, status: response.status() };
}

export async function getStreamStatus(idOrSlug: string): Promise<StreamStatusResponse | null> {
  const api = await getApiContext();
  const response = await api.get(endpoints.api.streamStatus(idOrSlug));
  if (response.status() === 404) return null;
  return response.json();
}

// Audit Logs
export async function getAuditLogs(params?: {
  event?: string;
  ip?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogResponse> {
  const api = await getApiContext();
  const searchParams = new URLSearchParams();
  if (params?.event) searchParams.set('event', params.event);
  if (params?.ip) searchParams.set('ip', params.ip);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const url = `${endpoints.api.audit}?${searchParams.toString()}`;
  const response = await api.get(url, {
    headers: sessionCookie ? { Cookie: sessionCookie } : {},
  });

  return response.json();
}

// Mux Assets
export async function getMuxAssets(params?: {
  limit?: number;
  cursor?: string;
}): Promise<MuxAsset[]> {
  const api = await getApiContext();
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.cursor) searchParams.set('cursor', params.cursor);

  const url = `${endpoints.api.muxAssets}?${searchParams.toString()}`;
  const response = await api.get(url, {
    headers: sessionCookie ? { Cookie: sessionCookie } : {},
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (response.status() >= 400) {
    const message =
      (payload as { error?: string } | null)?.error ||
      `Failed to fetch Mux assets (status ${response.status()})`;
    throw new Error(message);
  }

  let assets: MuxAsset[] = [];
  if (Array.isArray(payload)) {
    assets = payload as MuxAsset[];
  } else if (payload && Array.isArray((payload as { assets?: MuxAsset[] }).assets)) {
    assets = (payload as { assets: MuxAsset[] }).assets;
  } else if (payload && Array.isArray((payload as { data?: MuxAsset[] }).data)) {
    assets = (payload as { data: MuxAsset[] }).data;
  }

  return assets.map((asset) => {
    if (!asset.playback_ids && asset.playbackId) {
      return {
        ...asset,
        playback_ids: [
          {
            id: asset.playbackId,
            policy: asset.playbackPolicy || 'public',
          },
        ],
      };
    }
    return asset;
  });
}

// Rate limit testing helper
export async function attemptLoginMultipleTimes(
  times: number,
  password: string = 'wrong-password'
): Promise<{ responses: Array<{ status: number; body: unknown }>; rateLimited: boolean }> {
  const api = await getApiContext();
  const responses: Array<{ status: number; body: unknown }> = [];
  let rateLimited = false;

  for (let i = 0; i < times; i++) {
    const response = await api.post(endpoints.api.login, {
      data: { password },
      headers: { 'Content-Type': 'application/json' },
    });

    const status = response.status();
    const body = await response.json();
    responses.push({ status, body });

    if (status === 429) {
      rateLimited = true;
      break;
    }
  }

  return { responses, rateLimited };
}

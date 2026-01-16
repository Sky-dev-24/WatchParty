const BASE_URL = process.env.BASE_URL || "https://simulive.cloudysky.xyz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const TARGET_DURATION = process.env.TARGET_DURATION || process.env.DURATION || "1m";
const DURATION_BUFFER_SECONDS = Number(process.env.DURATION_BUFFER_SECONDS || 30);
const MAX_LOOP_COUNT = 10;

function parseDurationSeconds(value) {
  if (!value) return 60;
  const input = String(value).trim();
  const pattern = /(\d+(?:\.\d+)?)(ms|s|m|h)/gi;
  let total = 0;
  let matched = false;

  let match = pattern.exec(input);
  while (match) {
    matched = true;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === "ms") total += amount / 1000;
    if (unit === "s") total += amount;
    if (unit === "m") total += amount * 60;
    if (unit === "h") total += amount * 3600;
    match = pattern.exec(input);
  }

  if (matched) return total;

  const numeric = Number(input);
  return Number.isFinite(numeric) ? numeric : 60;
}

function sanitizeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { response, data };
}

function normalizeAssets(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.assets)) return payload.assets;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function hasPlaybackId(asset) {
  if (!asset) return false;
  if (Array.isArray(asset.playback_ids) && asset.playback_ids.length > 0) {
    return true;
  }
  if (asset.playbackId) return true;
  if (asset.playback_id) return true;
  return false;
}

async function main() {
  if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD is not set.");
  }

  const targetSeconds = Math.max(1, parseDurationSeconds(TARGET_DURATION)) + DURATION_BUFFER_SECONDS;
  const minBaseDuration = Math.ceil(targetSeconds / MAX_LOOP_COUNT);

  const login = await requestJson(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!login.response.ok) {
    const message = login.data?.error || `Login failed with status ${login.response.status}`;
    throw new Error(message);
  }

  const setCookie = login.response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) {
    throw new Error("No session cookie returned from login.");
  }

  const assetsResult = await requestJson(`${BASE_URL}/api/mux/assets?limit=50`, {
    headers: { Cookie: cookie },
  });

  if (!assetsResult.response.ok) {
    const message =
      assetsResult.data?.error ||
      `Failed to fetch Mux assets (status ${assetsResult.response.status})`;
    throw new Error(message);
  }

  const assets = normalizeAssets(assetsResult.data);
  const readyAssets = assets
    .filter((asset) => asset && asset.status === "ready")
    .filter((asset) => hasPlaybackId(asset))
    .map((asset) => ({
      id: asset.id,
      duration: Number(asset.duration || 0),
    }))
    .filter((asset) => asset.duration > 0);

  if (!readyAssets.length) {
    throw new Error("No ready Mux assets with duration found.");
  }

  readyAssets.sort((a, b) => b.duration - a.duration);

  const selectedAssets = [];
  let baseDuration = 0;
  for (const asset of readyAssets) {
    selectedAssets.push(asset);
    baseDuration += asset.duration;
    if (baseDuration >= minBaseDuration) break;
  }

  if (!selectedAssets.length || baseDuration < minBaseDuration) {
    throw new Error("Unable to select assets long enough for the requested duration.");
  }

  const loopCount = Math.min(
    MAX_LOOP_COUNT,
    Math.max(1, Math.ceil(targetSeconds / baseDuration))
  );

  const timestamp = Date.now();
  const title = process.env.STREAM_TITLE || `E2E Perf Test Stream ${timestamp}`;
  const slugInput = process.env.STREAM_SLUG || `e2e-perf-${timestamp}`;
  const slug = sanitizeSlug(slugInput);

  if (!slug) {
    throw new Error("STREAM_SLUG resulted in an empty slug after sanitizing.");
  }

  const scheduledStart = new Date(Date.now() - 10 * 1000).toISOString();
  const createResult = await requestJson(`${BASE_URL}/api/streams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      title,
      slug,
      assetIds: selectedAssets.map((asset) => asset.id),
      scheduledStart,
      loopCount,
    }),
  });

  if (!createResult.response.ok) {
    const message =
      createResult.data?.error ||
      `Failed to create stream (status ${createResult.response.status})`;
    throw new Error(message);
  }

  const stream = createResult.data;
  const activateResult = await requestJson(`${BASE_URL}/api/streams/${stream.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ isActive: true }),
  });

  if (!activateResult.response.ok) {
    const message =
      activateResult.data?.error ||
      `Failed to activate stream (status ${activateResult.response.status})`;
    throw new Error(message);
  }

  const totalDuration = baseDuration * loopCount;
  console.log(`Created perf stream: ${stream.title}`);
  console.log(`Slug: ${stream.slug}`);
  console.log(`ID: ${stream.id}`);
  console.log(`Assets: ${selectedAssets.length}, Loop count: ${loopCount}`);
  console.log(`Base duration: ${Math.round(baseDuration)}s`);
  console.log(`Total duration: ${Math.round(totalDuration)}s`);
  console.log(`Target duration: ${Math.round(targetSeconds)}s`);
  console.log(`Use with: STREAM_SLUG=${stream.slug}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

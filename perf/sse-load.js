const BASE_URL = process.env.BASE_URL || "https://simulive.cloudysky.xyz";
const STREAM_SLUG = process.env.STREAM_SLUG || "";
const CONNECTIONS = Number(process.env.CONNECTIONS || 5000);
const RAMP_UP = process.env.RAMP_UP || "5m";
const HOLD = process.env.HOLD || "10m";
const LOG_INTERVAL = process.env.LOG_INTERVAL || "30s";
const CONNECT_TIMEOUT = process.env.CONNECT_TIMEOUT || "15s";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!STREAM_SLUG) {
    throw new Error("STREAM_SLUG is required.");
  }

  const rampUpSeconds = Math.max(1, parseDurationSeconds(RAMP_UP));
  const holdSeconds = Math.max(1, parseDurationSeconds(HOLD));
  const logIntervalMs = Math.max(5, parseDurationSeconds(LOG_INTERVAL)) * 1000;
  const connectTimeoutMs =
    Math.max(1, parseDurationSeconds(CONNECT_TIMEOUT)) * 1000;

  const url = `${BASE_URL}/api/streams/${STREAM_SLUG}/events`;
  const delayMs = Math.max(1, Math.floor((rampUpSeconds * 1000) / CONNECTIONS));

  const controllers = [];
  const stats = {
    attempted: 0,
    connected: 0,
    active: 0,
    closed: 0,
    aborted: 0,
    errors: 0,
    chunks: 0,
    bytes: 0,
  };

  let shuttingDown = false;
  const tasks = [];

  async function openConnection(index) {
    stats.attempted += 1;
    const controller = new AbortController();
    controllers.push(controller);

    let connectTimer = setTimeout(() => controller.abort(), connectTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      clearTimeout(connectTimer);
      connectTimer = null;

      if (!response.ok) {
        stats.errors += 1;
        return;
      }

      const reader = response.body && response.body.getReader
        ? response.body.getReader()
        : null;
      if (!reader) {
        stats.errors += 1;
        return;
      }

      stats.connected += 1;
      stats.active += 1;

      while (true) {
        const result = await reader.read();
        if (result.done) break;
        if (result.value) {
          stats.chunks += 1;
          stats.bytes += result.value.length;
        }
      }
    } catch (error) {
      if (error && error.name === "AbortError") {
        stats.aborted += 1;
      } else {
        stats.errors += 1;
      }
    } finally {
      if (connectTimer) clearTimeout(connectTimer);
      if (stats.active > 0) stats.active -= 1;
      stats.closed += 1;
    }
  }

  function logProgress() {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] attempted=${stats.attempted} connected=${stats.connected} ` +
        `active=${stats.active} closed=${stats.closed} aborted=${stats.aborted} ` +
        `errors=${stats.errors} chunks=${stats.chunks}`
    );
  }

  const logTimer = setInterval(logProgress, logIntervalMs);

  process.on("SIGINT", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("Interrupted. Closing connections...");
    controllers.forEach((controller) => controller.abort());
  });

  for (let i = 0; i < CONNECTIONS; i += 1) {
    tasks.push(openConnection(i));
    await sleep(delayMs);
  }

  console.log(
    `Ramp complete. Holding ${CONNECTIONS} connections for ${holdSeconds}s...`
  );
  await sleep(holdSeconds * 1000);

  if (!shuttingDown) {
    shuttingDown = true;
    console.log("Closing connections...");
    controllers.forEach((controller) => controller.abort());
  }

  await Promise.allSettled(tasks);
  clearInterval(logTimer);
  logProgress();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

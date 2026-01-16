import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://simulive.cloudysky.xyz";
const TARGET_VUS = Number(__ENV.TARGET_VUS || 2000);
const RAMP_UP = __ENV.RAMP_UP || "5m";
const HOLD = __ENV.HOLD || "10m";
const RAMP_DOWN = __ENV.RAMP_DOWN || "3m";
const LOOP_SLEEP = Number(__ENV.LOOP_SLEEP || 1);
const STATUS_INTERVAL = Number(__ENV.STATUS_INTERVAL || 30);
const TIME_INTERVAL = Number(__ENV.TIME_INTERVAL || 180);
const WATCH_SHARE = Number(__ENV.WATCH_SHARE || 0.4);
const STREAM_SLUG = __ENV.STREAM_SLUG || "";

export const options = {
  scenarios: {
    viewers: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: TARGET_VUS },
        { duration: HOLD, target: TARGET_VUS },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

let viewerInitialized = false;
let viewerSlug = "";
let viewerMode = "watch";
let lastStatusCheck = 0;
let lastTimeCheck = 0;

function pickSlug(streams) {
  if (STREAM_SLUG) {
    return STREAM_SLUG;
  }
  return streams[0] && streams[0].slug ? streams[0].slug : "";
}

export function setup() {
  const streamsRes = http.get(`${BASE_URL}/api/streams`);
  const streams = streamsRes.status === 200 ? streamsRes.json() : [];
  const slug = Array.isArray(streams) ? pickSlug(streams) : "";

  return { slug };
}

function initViewer(slug) {
  viewerSlug = slug;
  viewerMode = Math.random() < WATCH_SHARE ? "watch" : "embed";

  const pagePath = viewerMode === "watch" ? "watch" : "embed";
  const pageRes = http.get(`${BASE_URL}/${pagePath}/${viewerSlug}`);
  check(pageRes, { "page ok": (res) => res.status === 200 });

  const timeRes = http.get(`${BASE_URL}/api/time`);
  check(timeRes, { "time ok": (res) => res.status === 200 });

  const statusRes = http.get(`${BASE_URL}/api/streams/${viewerSlug}/status`);
  check(statusRes, { "status ok": (res) => res.status === 200 });

  const now = Date.now();
  lastStatusCheck = now;
  lastTimeCheck = now;
  viewerInitialized = true;
}

export default function (data) {
  if (!data.slug) {
    sleep(LOOP_SLEEP);
    return;
  }

  if (!viewerInitialized) {
    initViewer(data.slug);
    sleep(LOOP_SLEEP);
    return;
  }

  const now = Date.now();
  if (now - lastStatusCheck >= STATUS_INTERVAL * 1000) {
    const statusRes = http.get(`${BASE_URL}/api/streams/${viewerSlug}/status`);
    check(statusRes, { "status ok": (res) => res.status === 200 });
    lastStatusCheck = now;
  }

  if (now - lastTimeCheck >= TIME_INTERVAL * 1000) {
    const timeRes = http.get(`${BASE_URL}/api/time`);
    check(timeRes, { "time ok": (res) => res.status === 200 });
    lastTimeCheck = now;
  }

  sleep(LOOP_SLEEP);
}

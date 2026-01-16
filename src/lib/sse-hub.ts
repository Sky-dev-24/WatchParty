import type Redis from "ioredis";
import { createSubscriberClient, STREAM_EVENTS_CHANNEL } from "@/lib/redis";

type Controller = ReadableStreamDefaultController<Uint8Array>;

const encoder = new TextEncoder();
const clientsBySlug = new Map<string, Set<Controller>>();
const HEARTBEAT_INTERVAL_MS = 30000;
let heartbeatTimer: NodeJS.Timeout | null = null;
let subscriber: Redis | null = null;
let subscriberReady: Promise<void> | null = null;

function ensureHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const payload = encoder.encode(`: heartbeat ${Date.now()}\n\n`);
    for (const [slug, controllers] of clientsBySlug.entries()) {
      for (const controller of Array.from(controllers)) {
        try {
          controller.enqueue(payload);
        } catch {
          controllers.delete(controller);
        }
      }
      if (controllers.size === 0) {
        clientsBySlug.delete(slug);
      }
    }
    if (clientsBySlug.size === 0 && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function removeClient(slug: string, controller: Controller): void {
  const controllers = clientsBySlug.get(slug);
  if (!controllers) return;
  controllers.delete(controller);
  if (controllers.size === 0) {
    clientsBySlug.delete(slug);
  }
  if (clientsBySlug.size === 0 && heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function closeSlugClients(slug: string): void {
  const controllers = clientsBySlug.get(slug);
  if (!controllers) return;
  for (const controller of Array.from(controllers)) {
    try {
      controller.close();
    } catch {
      // Ignore already-closed streams
    }
  }
  clientsBySlug.delete(slug);
  if (clientsBySlug.size === 0 && heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function broadcastEvent(slug: string, eventName: string, payload: string): void {
  const controllers = clientsBySlug.get(slug);
  if (!controllers || controllers.size === 0) return;

  const message = encoder.encode(`event: ${eventName}\ndata: ${payload}\n\n`);
  for (const controller of Array.from(controllers)) {
    try {
      controller.enqueue(message);
    } catch {
      controllers.delete(controller);
    }
  }

  if (eventName === "stopped") {
    setTimeout(() => closeSlugClients(slug), 100);
  }
}

async function ensureSubscriber(): Promise<void> {
  if (subscriberReady) return subscriberReady;

  subscriberReady = (async () => {
    subscriber = createSubscriberClient();
    subscriber.on("error", (error) => {
      console.error("[SSE] Redis subscriber error:", error.message);
    });

    subscriber.on("pmessage", (_pattern, channel, message) => {
      if (!channel.startsWith(STREAM_EVENTS_CHANNEL)) return;
      const slug = channel.slice(STREAM_EVENTS_CHANNEL.length);
      if (!slug) return;
      try {
        const event = JSON.parse(message);
        if (!event?.type) return;
        broadcastEvent(slug, event.type, message);
      } catch (error) {
        console.error("[SSE] Failed to parse stream event:", error);
      }
    });

    await subscriber.psubscribe(`${STREAM_EVENTS_CHANNEL}*`);
  })();

  return subscriberReady;
}

export async function registerStreamEventClient(
  slug: string,
  controller: Controller,
  signal: AbortSignal
): Promise<void> {
  await ensureSubscriber();
  let controllers = clientsBySlug.get(slug);
  if (!controllers) {
    controllers = new Set();
    clientsBySlug.set(slug, controllers);
  }
  controllers.add(controller);
  ensureHeartbeat();

  const cleanup = () => removeClient(slug, controller);
  if (signal.aborted) {
    cleanup();
    return;
  }
  signal.addEventListener("abort", cleanup, { once: true });
}

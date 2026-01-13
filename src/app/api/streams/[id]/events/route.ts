import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  createSubscriberClient,
  STREAM_EVENTS_CHANNEL,
  isRedisConfigured,
} from "@/lib/redis";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * SSE endpoint for real-time stream events (force-stop detection)
 * Clients connect here to receive instant notifications when a stream is stopped/resumed
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Resolve by ID or slug
  const stream = await prisma.stream.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { slug: true, endedAt: true, isActive: true },
  });

  if (!stream) {
    return new Response("Stream not found", { status: 404 });
  }

  // If already ended, send that immediately and close
  if (stream.endedAt) {
    const encoder = new TextEncoder();
    return new Response(
      encoder.encode(
        `event: stopped\ndata: ${JSON.stringify({ endedAt: stream.endedAt })}\n\n`
      ),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  if (!isRedisConfigured()) {
    return new Response("Redis is required", { status: 503 });
  }

  const subscriber = createSubscriberClient();

  const channel = `${STREAM_EVENTS_CHANNEL}${stream.slug}`;
  const encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ slug: stream.slug })}\n\n`
        )
      );

      // Heartbeat every 30s to keep connection alive through proxies/load balancers
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Subscribe to stream events
      try {
        await subscriber.subscribe(channel);
      } catch (error) {
        console.error("[SSE] Failed to subscribe:", error);
        clearInterval(heartbeat);
        controller.close();
        return;
      }

      subscriber.on("message", (ch, message) => {
        if (ch !== channel) return;

        try {
          const event = JSON.parse(message);
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${message}\n\n`)
          );

          // If stream stopped, close the connection after sending the event
          if (event.type === "stopped") {
            setTimeout(() => {
              clearInterval(heartbeat);
              subscriber.unsubscribe(channel).catch(() => {});
              subscriber.quit().catch(() => {});
              try {
                controller.close();
              } catch {
                // Already closed
              }
            }, 100);
          }
        } catch (error) {
          console.error("[SSE] Error processing message:", error);
        }
      });

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

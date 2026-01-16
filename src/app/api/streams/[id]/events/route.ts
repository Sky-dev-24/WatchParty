import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { isRedisConfigured } from "@/lib/redis";
import { registerStreamEventClient } from "@/lib/sse-hub";

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

  const encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ slug: stream.slug })}\n\n`
        )
      );

      try {
        await registerStreamEventClient(stream.slug, controller, request.signal);
      } catch (error) {
        console.error("[SSE] Failed to register client:", error);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
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

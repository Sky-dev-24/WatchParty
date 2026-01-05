import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isApiAuthenticated, getClientIp } from "@/lib/auth";
import { deleteCached } from "@/lib/redis";
import { logStreamUpdated, logStreamDeleted } from "@/lib/audit";

const STREAMS_CACHE_KEY = "streams:all";

async function invalidateStreamsCache() {
  await deleteCached(STREAMS_CACHE_KEY);
}

async function invalidateStatusCache(streamId: string, slug: string) {
  // Invalidate both ID and slug-based cache keys
  await Promise.all([
    deleteCached(`stream:${streamId}:status`),
    deleteCached(`stream:${slug}:status`),
  ]);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/streams/[id] - Get a single stream
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const stream = await prisma.stream.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    return NextResponse.json(stream);
  } catch (error) {
    console.error("Failed to fetch stream:", error);
    return NextResponse.json(
      { error: "Failed to fetch stream" },
      { status: 500 }
    );
  }
}

// PATCH /api/streams/[id] - Update a stream
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!(await isApiAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = [
      "title",
      "slug",
      "scheduledStart",
      "isActive",
      "syncInterval",
      "driftTolerance",
      "endedAt",
      "loopCount",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "scheduledStart") {
          updateData[field] = new Date(body[field]);
        } else if (field === "endedAt") {
          // endedAt can be null (to resume) or a date string (to stop)
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else if (field === "loopCount") {
          // loopCount must be between 1 and 10
          updateData[field] = Math.min(10, Math.max(1, body[field]));
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Validate slug if being updated
    if (updateData.slug && !/^[a-z0-9-]+$/.test(updateData.slug as string)) {
      return NextResponse.json(
        {
          error:
            "Slug must contain only lowercase letters, numbers, and hyphens",
        },
        { status: 400 }
      );
    }

    const stream = await prisma.stream.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Log stream update
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    await logStreamUpdated(clientIp, userAgent, {
      id: stream.id,
      title: stream.title,
      changes: Object.keys(updateData),
    });

    // Invalidate caches after update
    await invalidateStreamsCache();

    // Invalidate status cache if endedAt or isActive changed (for force-stop polling)
    if (updateData.endedAt !== undefined || updateData.isActive !== undefined) {
      await invalidateStatusCache(stream.id, stream.slug);
    }

    return NextResponse.json(stream);
  } catch (error) {
    console.error("Failed to update stream:", error);
    return NextResponse.json(
      { error: "Failed to update stream" },
      { status: 500 }
    );
  }
}

// DELETE /api/streams/[id] - Delete a stream
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!(await isApiAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get stream info before deletion for logging
    const stream = await prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    await prisma.stream.delete({
      where: { id },
    });

    // Log stream deletion
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    await logStreamDeleted(clientIp, userAgent, {
      id: stream.id,
      title: stream.title,
    });

    // Invalidate cache after delete
    await invalidateStreamsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete stream:", error);
    return NextResponse.json(
      { error: "Failed to delete stream" },
      { status: 500 }
    );
  }
}

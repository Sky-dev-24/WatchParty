import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/streams/[id]/status - Lightweight status check for polling
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Try to find by ID first, then by slug
    let stream = await prisma.stream.findUnique({
      where: { id },
      select: { endedAt: true, isActive: true },
    });

    if (!stream) {
      stream = await prisma.stream.findUnique({
        where: { slug: id },
        select: { endedAt: true, isActive: true },
      });
    }

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    return NextResponse.json({
      endedAt: stream.endedAt?.toISOString() || null,
      isActive: stream.isActive,
    });
  } catch (error) {
    console.error("Failed to fetch stream status:", error);
    return NextResponse.json(
      { error: "Failed to fetch stream status" },
      { status: 500 }
    );
  }
}

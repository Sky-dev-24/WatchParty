import { NextRequest, NextResponse } from "next/server";
import { isApiAuthenticated } from "@/lib/auth";
import { getAuditLogs, AuditEvent } from "@/lib/audit";

// GET /api/admin/audit - Get audit logs (admin only)
// Query params:
//   - event: filter by event type (e.g., "LOGIN_FAILED")
//   - ip: filter by IP address
//   - limit: number of records (default 100, max 500)
//   - offset: pagination offset
export async function GET(request: NextRequest) {
  // Require admin authentication
  if (!(await isApiAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const event = searchParams.get("event") as keyof typeof AuditEvent | null;
    const ipAddress = searchParams.get("ip") || undefined;
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    // Parse and validate limit
    let limit = limitParam ? parseInt(limitParam, 10) : 100;
    if (isNaN(limit) || limit < 1) limit = 100;
    if (limit > 500) limit = 500;

    // Parse offset
    let offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    if (isNaN(offset) || offset < 0) offset = 0;

    // Validate event type if provided
    const validEvent = event && AuditEvent[event] ? AuditEvent[event] : undefined;

    const result = await getAuditLogs({
      event: validEvent,
      ipAddress,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}

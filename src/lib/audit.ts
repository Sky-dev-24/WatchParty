import prisma from "./db";

// Audit event types
export const AuditEvent = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_RATE_LIMITED: "LOGIN_RATE_LIMITED",
  LOGOUT: "LOGOUT",
  STREAM_CREATED: "STREAM_CREATED",
  STREAM_UPDATED: "STREAM_UPDATED",
  STREAM_DELETED: "STREAM_DELETED",
} as const;

export type AuditEventType = (typeof AuditEvent)[keyof typeof AuditEvent];

// Severity levels
export const Severity = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

export type SeverityType = (typeof Severity)[keyof typeof Severity];

interface AuditLogEntry {
  event: AuditEventType;
  severity?: SeverityType;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        event: entry.event,
        severity: entry.severity || Severity.INFO,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent ? entry.userAgent.slice(0, 500) : null, // Truncate long user agents
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });
  } catch (error) {
    // Don't let audit logging failures break the app
    console.error("[Audit] Failed to log event:", error);
  }
}

/**
 * Log a failed login attempt
 */
export async function logFailedLogin(
  ipAddress: string,
  userAgent?: string,
  reason?: string
): Promise<void> {
  await logAuditEvent({
    event: AuditEvent.LOGIN_FAILED,
    severity: Severity.WARN,
    ipAddress,
    userAgent,
    details: { reason: reason || "Invalid password" },
  });
}

/**
 * Log a successful login
 */
export async function logSuccessfulLogin(
  ipAddress: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    event: AuditEvent.LOGIN_SUCCESS,
    severity: Severity.INFO,
    ipAddress,
    userAgent,
  });
}

/**
 * Log a rate-limited login attempt
 */
export async function logRateLimitedLogin(
  ipAddress: string,
  userAgent?: string,
  retryAfterSeconds?: number
): Promise<void> {
  await logAuditEvent({
    event: AuditEvent.LOGIN_RATE_LIMITED,
    severity: Severity.WARN,
    ipAddress,
    userAgent,
    details: { retryAfterSeconds },
  });
}

/**
 * Log a logout event
 */
export async function logLogout(
  ipAddress: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    event: AuditEvent.LOGOUT,
    severity: Severity.INFO,
    ipAddress,
    userAgent,
  });
}

/**
 * Get recent audit logs with optional filtering
 */
export async function getAuditLogs(options?: {
  event?: AuditEventType;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}) {
  const { event, ipAddress, limit = 100, offset = 0 } = options || {};

  const where: Record<string, unknown> = {};
  if (event) where.event = event;
  if (ipAddress) where.ipAddress = ipAddress;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    })),
    total,
    limit,
    offset,
  };
}

/**
 * Get login attempt summary for an IP address
 */
export async function getLoginAttemptsByIp(ipAddress: string, hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const attempts = await prisma.auditLog.groupBy({
    by: ["event"],
    where: {
      ipAddress,
      event: { in: [AuditEvent.LOGIN_SUCCESS, AuditEvent.LOGIN_FAILED, AuditEvent.LOGIN_RATE_LIMITED] },
      timestamp: { gte: since },
    },
    _count: true,
  });

  return attempts.reduce(
    (acc, curr) => {
      acc[curr.event] = curr._count;
      return acc;
    },
    {} as Record<string, number>
  );
}

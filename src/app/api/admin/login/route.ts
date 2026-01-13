import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminPassword,
  createAdminSession,
  getClientIp,
  ADMIN_COOKIE_NAME,
  COOKIE_MAX_AGE,
} from "@/lib/auth";
import { checkLoginRateLimit, resetLoginRateLimit, isRedisConfigured } from "@/lib/redis";
import {
  logFailedLogin,
  logSuccessfulLogin,
  logRateLimitedLogin,
} from "@/lib/audit";

export async function POST(request: NextRequest) {
  if (!isRedisConfigured()) {
    return NextResponse.json(
      { error: "Redis is required for admin authentication." },
      { status: 503 }
    );
  }

  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  let rateLimit: Awaited<ReturnType<typeof checkLoginRateLimit>>;
  try {
    // Check rate limit BEFORE processing login
    rateLimit = await checkLoginRateLimit(clientIp);
  } catch (error) {
    console.error("[Auth] Rate limit check failed:", error);
    return NextResponse.json(
      { error: "Authentication unavailable. Please try again later." },
      { status: 503 }
    );
  }

  if (!rateLimit.allowed) {
    // Log rate-limited attempt
    await logRateLimitedLogin(clientIp, userAgent, rateLimit.retryAfterSeconds);

    return NextResponse.json(
      {
        error: "Too many login attempts. Please try again later.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds || 900),
        },
      }
    );
  }

  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      await logFailedLogin(clientIp, userAgent, "Missing password");
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (!verifyAdminPassword(password)) {
      // Log failed login attempt
      await logFailedLogin(clientIp, userAgent, "Invalid password");

      return NextResponse.json(
        {
          error: "Invalid password",
          attemptsRemaining: rateLimit.attemptsRemaining,
        },
        { status: 401 }
      );
    }

    // Password correct - create secure session
    const sessionToken = await createAdminSession();

    if (!sessionToken) {
      await logFailedLogin(clientIp, userAgent, "Session creation failed");
      return NextResponse.json(
        { error: "Failed to create session. Please try again." },
        { status: 500 }
      );
    }

    // Reset rate limit on successful login
    try {
      await resetLoginRateLimit(clientIp);
    } catch (error) {
      console.error("[Auth] Failed to reset rate limit:", error);
    }

    // Log successful login
    await logSuccessfulLogin(clientIp, userAgent);

    const response = NextResponse.json({ success: true });

    // Set auth cookie with secure session token
    const useSecureCookies = process.env.SECURE_COOKIES === "true";
    response.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    await logFailedLogin(clientIp, userAgent, "Invalid request format");
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

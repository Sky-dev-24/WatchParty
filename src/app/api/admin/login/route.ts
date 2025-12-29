import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminPassword,
  getAdminCookieValue,
  ADMIN_COOKIE_NAME,
  COOKIE_MAX_AGE,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });

    // Set auth cookie
    // Only use secure cookies if explicitly enabled (for HTTPS deployments)
    const useSecureCookies = process.env.SECURE_COOKIES === "true";
    response.cookies.set(ADMIN_COOKIE_NAME, getAdminCookieValue(), {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

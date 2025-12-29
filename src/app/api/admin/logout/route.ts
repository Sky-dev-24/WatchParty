import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the auth cookie
  const useSecureCookies = process.env.SECURE_COOKIES === "true";
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

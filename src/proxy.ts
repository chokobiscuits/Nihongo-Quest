import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/// Simple shared-password gate for this single-user app: no accounts, no
/// email, just one password in APP_PASSWORD checked against a signed session
/// cookie. If APP_PASSWORD is unset, the gate is fully bypassed — local dev
/// and any deployment that doesn't opt in are unaffected.
const PUBLIC_PATHS = ["/login", "/api/login"];

export async function proxy(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.APP_SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionSecret && (await verifySessionToken(token, sessionSecret))) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Every route except static assets and Next internals — matches the
  // "everything except /login, /api/login, static, /_next/*" requirement.
  // /login and /api/login are excluded above rather than here so the
  // matcher stays a single simple exclusion list.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|uploads/|crests/).*)"],
};

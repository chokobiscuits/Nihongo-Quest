import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/// Per-user auth gate: every route requires a valid signed session cookie
/// (see src/lib/auth.ts and src/app/api/login/route.ts), identifying one of
/// the four provisioned accounts. There is no bypass — APP_PASSWORD has been
/// retired, and a missing/misconfigured APP_SESSION_SECRET fails closed
/// (redirects to /login) rather than opening the app to every visitor.
const PUBLIC_PATHS = ["/login", "/api/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.APP_SESSION_SECRET?.trim();
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

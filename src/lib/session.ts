import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/// Server-only: reads and verifies the session cookie set by /api/login,
/// returning the signed-in user's UserProfile.userId.
///
/// This is the single place every server component, server action, and
/// route handler should go to find out who is logged in — never trust a
/// userId passed in from the client (see the resetProgress/commit* actions,
/// which used to accept one as a default-overridable parameter).
///
/// Redirects to /login if the cookie is missing, forged, or expired, or if
/// APP_SESSION_SECRET isn't configured. There is no "fall back to a default
/// user" path: once per-user auth is live, an unauthenticated request has no
/// identity to operate as.
export async function getCurrentUserId(): Promise<string> {
  const sessionSecret = process.env.APP_SESSION_SECRET?.trim();
  if (!sessionSecret) {
    console.error("[session] APP_SESSION_SECRET is not configured");
    redirect("/login");
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const appUserId = await verifySessionToken(token, sessionSecret);
  if (!appUserId) {
    redirect("/login");
  }

  return appUserId;
}

/// Same lookup, but returns null instead of redirecting. For call sites that
/// need to behave differently when logged out rather than bouncing (e.g.
/// layout.tsx, which must still render chrome for /login itself).
export async function getCurrentUserIdOrNull(): Promise<string | null> {
  const sessionSecret = process.env.APP_SESSION_SECRET?.trim();
  if (!sessionSecret) return null;

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token, sessionSecret);
}

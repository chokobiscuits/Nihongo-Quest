import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, signSessionToken, verifyPassword } from "@/lib/auth";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/// Handles the login form POST from /login. Checks the submitted password
/// against APP_PASSWORD and, on success, sets a signed session cookie —
/// httpOnly, secure, sameSite=lax, 30-day expiry since this is a personal
/// app with no reason to force frequent re-auth.
export async function POST(request: NextRequest) {
  // Trimmed: pasting a value into a hosting dashboard very easily picks up a
  // trailing newline or space, and an untrimmed compare then fails for
  // credentials that look correct in the UI. The submitted values are
  // trimmed too, since a password manager or mobile keyboard can append a
  // space on autofill.
  const appPassword = process.env.APP_PASSWORD?.trim();
  const sessionSecret = process.env.APP_SESSION_SECRET?.trim();

  if (!appPassword || !sessionSecret) {
    return NextResponse.json({ ok: false, error: "Login is not configured." }, { status: 500 });
  }

  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "").trim();

  // Both checks run regardless of whether the first failed, so a wrong
  // username and a wrong password take the same time and neither can be
  // probed independently.
  const appUsername = process.env.APP_USERNAME?.trim() ?? "";
  const userOk = appUsername === "" || verifyPassword(username, appUsername);
  const passOk = verifyPassword(password, appPassword);

  if (!userOk || !passOk) {
    // Which half failed, and the lengths, never the values. Without this a
    // failed login is indistinguishable from a misconfigured one, and the
    // only place to look is a platform log that says nothing.
    console.warn(
      `[login] rejected: username ${userOk ? "ok" : "mismatch"}, password ${passOk ? "ok" : "mismatch"} ` +
        `(submitted ${username.length}/${password.length} chars, expected ${appUsername.length}/${appPassword.length})`,
    );
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, await signSessionToken(sessionSecret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: THIRTY_DAYS_SECONDS,
    path: "/",
  });
  return response;
}

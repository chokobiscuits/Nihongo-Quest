import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { createSupabaseAdminClient, syntheticEmailForUsername } from "@/lib/supabaseAdmin";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/// Handles the login form POST from /login. Looks up the submitted username
/// in `auth_username_map` (service role only — never exposed to anon/
/// authenticated Postgres roles), then checks the password by calling
/// Supabase Auth's signInWithPassword against the mapped synthetic email.
/// Supabase Auth exists purely to store/check the password here: on success
/// we set our own HMAC-signed session cookie carrying the app's own
/// UserProfile.userId, and never pass a Supabase session/JWT into the rest
/// of the app (see src/lib/session.ts).
export async function POST(request: NextRequest) {
  const sessionSecret = process.env.APP_SESSION_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ ok: false, error: "Login is not configured." }, { status: 500 });
  }

  const form = await request.formData();
  // Trimmed: pasting a value easily picks up a trailing newline or space,
  // and an untrimmed compare then fails for credentials that look correct in
  // the UI. The password is intentionally NOT trimmed — a user-chosen
  // password's whitespace is meaningful and Supabase Auth checks it exactly.
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!username || !password) {
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    console.error("[login] Supabase admin client unavailable:", error);
    return NextResponse.json({ ok: false, error: "Login is not configured." }, { status: 500 });
  }

  const { data: mapping, error: lookupError } = await admin
    .from("auth_username_map")
    .select("app_user_id")
    .ilike("username", username)
    .maybeSingle();

  if (lookupError) {
    console.error("[login] auth_username_map lookup failed:", lookupError.message);
    return NextResponse.json({ ok: false, error: "Login is temporarily unavailable." }, { status: 500 });
  }

  // Always attempt signInWithPassword, even for an unknown username, against
  // a fixed synthetic email — so an unknown username and a wrong password
  // take the same code path and roughly the same time, and neither can be
  // probed independently for account enumeration.
  const email = syntheticEmailForUsername(mapping ? username : "unknown-user");
  const { error: signInError } = await admin.auth.signInWithPassword({ email, password });

  if (!mapping || signInError) {
    console.warn(
      `[login] rejected: username ${mapping ? "known" : "unknown"}` +
        (signInError ? `, signInWithPassword error: ${signInError.message}` : ""),
    );
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(
    SESSION_COOKIE_NAME,
    await signSessionToken(sessionSecret, mapping.app_user_id as string, THIRTY_DAYS_SECONDS),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: THIRTY_DAYS_SECONDS,
      path: "/",
    },
  );
  return response;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/// Server-only Supabase client, authenticated with the service role key.
///
/// Used exactly two ways in this app: (1) /api/login looks up a username in
/// `auth_username_map` and calls `signInWithPassword` against the matching
/// synthetic email to check the submitted password, and (2)
/// scripts/provision-auth-users.ts creates the four accounts via the Auth
/// Admin API. Nothing else needs it — Prisma (src/lib/db.ts) is the data
/// layer for everything else and bypasses RLS entirely, so no Supabase
/// session or JWT is ever passed through the app.
///
/// Never import this from client code: SUPABASE_SERVICE_ROLE_KEY must never
/// reach the browser.
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/// The non-deliverable, unguessable-only-by-username email Supabase Auth
/// uses as this user's identity. Never used for password recovery or email
/// delivery — see docs/multi-user-auth-migration.md.
export function syntheticEmailForUsername(username: string): string {
  return `${username.toLowerCase()}@users.invalid`;
}

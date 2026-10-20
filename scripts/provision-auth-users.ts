/**
 * One-time account provisioning for the planned Supabase Auth migration.
 *
 * Usage (server-side only, after multi-user session support is implemented):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   INITIAL_USER_PASSWORD=... npx tsx scripts/provision-auth-users.ts
 *
 * Never commit credentials. Requires the username-login mapping migration.
 * This script does not modify existing users or reset their passwords.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.INITIAL_USER_PASSWORD;
if (!url || !serviceRoleKey || !password) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or INITIAL_USER_PASSWORD");
}
if (password.length < 10) {
  throw new Error("Choose an initial password of at least 10 characters");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const usernames = ["Matthieu123", "Lily123", "Eliane123"] as const;

// Auth needs an email/phone identity. These internal, non-deliverable
// addresses must NEVER be used for password recovery or email delivery.
// The production username login must resolve names server-side and implement
// a separate verified recovery flow before enabling this approach.
for (const username of usernames) {
  const email = `${username.toLowerCase()}@users.invalid`;
  const { data: existing, error: lookupError } = await admin
    .from("auth_username_map")
    .select("auth_user_id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    console.log(`Skipping existing username: ${username}`);
    continue;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { username, username_only: true },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${username}`);
  const { error: mapError } = await admin.from("auth_username_map").insert({
    username, auth_user_id: data.user.id,
  });
  if (mapError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw mapError;
  }
  console.log(`Provisioned ${username}`);
}

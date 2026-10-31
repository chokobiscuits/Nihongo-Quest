/**
 * One-time account provisioning for the multi-user Supabase Auth migration.
 * Idempotent: safe to re-run — existing usernames and existing UserProfile
 * rows are left untouched and skipped.
 *
 * Usage (run once against each environment you're deploying to):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
 *   OWNER_APP_USER_ID=<verified prod UserProfile.userId> \
 *   OWNER_PASSWORD=... NEW_USER_PASSWORD=Password123 \
 *   npx tsx --env-file=.env scripts/provision-auth-users.ts
 *
 * What it does:
 * - ChokoBiscuits: creates (or updates the password of) a Supabase Auth user
 *   for the existing owner account, and maps it to OWNER_APP_USER_ID — the
 *   UserProfile.userId that already exists in production. Does NOT create or
 *   modify that UserProfile row; the whole point is to preserve it exactly.
 * - Matthieu123, Lily123, Eliane123: creates a fresh Supabase Auth user, a
 *   fresh UserProfile row (Learner, level 1, 0 XP, Iron IV — the same
 *   defaults src/server/queries/profile.ts's getOrCreateProfile creates),
 *   and the username mapping, all with NEW_USER_PASSWORD (Password123).
 *
 * Never commit credentials. Requires the auth_username_map migration
 * (supabase/migrations/20261021_auth_username_map.sql) to already be
 * applied.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/db";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerAppUserId = process.env.OWNER_APP_USER_ID?.trim();
const ownerPassword = process.env.OWNER_PASSWORD;
const newUserPassword = process.env.NEW_USER_PASSWORD ?? "Password123";

if (!url || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
}
if (!ownerAppUserId) {
  throw new Error(
    "Missing OWNER_APP_USER_ID. Verify the existing prod UserProfile.userId first " +
      "(e.g. `SELECT \"userId\" FROM \"UserProfile\";`) — do not guess it.",
  );
}
if (!ownerPassword) {
  throw new Error("Missing OWNER_PASSWORD (the password ChokoBiscuits should keep signing in with)");
}
if (newUserPassword.length < 10) {
  throw new Error("Choose a NEW_USER_PASSWORD of at least 10 characters");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function syntheticEmailForUsername(username: string): string {
  return `${username.toLowerCase()}@users.invalid`;
}

/// Finds an existing auth.users row by email via the Admin API (there is no
/// getUserByEmail; listUsers is the supported way to look one up without
/// raw SQL against the auth schema).
async function findExistingAuthUser(email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function provisionOwner() {
  const username = "ChokoBiscuits";
  const email = syntheticEmailForUsername(username);

  const { data: existingMapping, error: lookupError } = await admin
    .from("auth_username_map")
    .select("auth_user_id, app_user_id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existingMapping) {
    if (existingMapping.app_user_id !== ownerAppUserId) {
      throw new Error(
        `auth_username_map already maps ${username} to app_user_id ` +
          `${existingMapping.app_user_id}, which does not match OWNER_APP_USER_ID ` +
          `(${ownerAppUserId}). Refusing to overwrite — check which is correct.`,
      );
    }
    console.log(`Skipping existing username: ${username} (already mapped to ${ownerAppUserId})`);
    return;
  }

  // The owner may already have a Supabase Auth user from an earlier partial
  // run — reuse it and just (re-)set the password, rather than creating a
  // duplicate.
  let authUserId: string;
  const existingAuthUser = await findExistingAuthUser(email);
  if (existingAuthUser) {
    const { error } = await admin.auth.admin.updateUserById(existingAuthUser.id, { password: ownerPassword });
    if (error) throw error;
    authUserId = existingAuthUser.id;
    console.log(`Reused existing Supabase Auth user for ${username}, password set.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: ownerPassword,
      email_confirm: true,
      app_metadata: { username, username_only: true },
    });
    if (error || !data.user) throw error ?? new Error(`Could not create ${username}`);
    authUserId = data.user.id;
  }

  // Verify the UserProfile this account is about to be mapped to actually
  // exists — provisioning the owner must never silently create a fresh,
  // empty one. If it's missing, something upstream is wrong and this must
  // stop rather than guess.
  const ownerProfile = await prisma.userProfile.findUnique({ where: { userId: ownerAppUserId! } });
  if (!ownerProfile) {
    throw new Error(
      `No UserProfile found for OWNER_APP_USER_ID (${ownerAppUserId}). Confirm the id is correct ` +
        `before re-running — this script never creates a UserProfile for the owner.`,
    );
  }

  const { error: mapError } = await admin
    .from("auth_username_map")
    .insert({ username, auth_user_id: authUserId, app_user_id: ownerAppUserId });
  if (mapError) {
    if (!existingAuthUser) await admin.auth.admin.deleteUser(authUserId);
    throw mapError;
  }
  console.log(`Provisioned ${username} -> existing UserProfile ${ownerAppUserId}`);
}

async function provisionNewUser(username: string) {
  const email = syntheticEmailForUsername(username);

  const { data: existing, error: lookupError } = await admin
    .from("auth_username_map")
    .select("auth_user_id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    console.log(`Skipping existing username: ${username}`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: newUserPassword,
    email_confirm: true,
    app_metadata: { username, username_only: true },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${username}`);

  // Same defaults as getOrCreateProfile (src/server/queries/profile.ts):
  // Learner, level 1, 0 XP, Iron IV.
  const appUserId = randomUUID();
  try {
    await prisma.userProfile.create({
      data: {
        userId: appUserId,
        displayName: username,
        totalXp: 0,
        accountLevel: 1,
        rank: "IRON",
        rankDivision: 4,
        currentStreak: 0,
        longestStreak: 0,
      },
    });
  } catch (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }

  const { error: mapError } = await admin
    .from("auth_username_map")
    .insert({ username, auth_user_id: data.user.id, app_user_id: appUserId });
  if (mapError) {
    await admin.auth.admin.deleteUser(data.user.id);
    await prisma.userProfile.delete({ where: { userId: appUserId } });
    throw mapError;
  }
  console.log(`Provisioned ${username} -> new UserProfile ${appUserId}`);
}

(async () => {
  try {
    await provisionOwner();
    for (const username of ["Matthieu123", "Lily123", "Eliane123"] as const) {
      await provisionNewUser(username);
    }
    console.log("\nDone.");
  } finally {
    await prisma.$disconnect();
  }
})();

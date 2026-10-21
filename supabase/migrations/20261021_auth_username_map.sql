-- Username-to-Supabase-Auth-identity mapping, with the UserProfile.userId
-- each username signs in as. Apply this before running
-- scripts/provision-auth-users.ts, and before deploying the login route that
-- reads it (src/app/api/login/route.ts).
--
-- Service-role only, same as the rest of this table: no anon/authenticated
-- Postgres role may read or write it, and there are no client-facing RLS
-- policies. The login route queries it with the service role key from a
-- server-only module (src/lib/supabaseAdmin.ts) — it is never reachable from
-- the browser.
create table if not exists public.auth_username_map (
  username text primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  -- UserProfile.userId (Prisma's data layer, NOT a Supabase Auth id) that
  -- this username signs in as. Text, not a foreign key: UserProfile lives in
  -- the same Postgres database but Prisma manages that table outside
  -- Supabase's migration system, and this mapping must survive independently
  -- of whether a matching UserProfile row exists yet (provisioning creates
  -- the Supabase Auth user and this row first, then the UserProfile row).
  app_user_id text not null,
  created_at timestamptz not null default now(),
  constraint auth_username_map_username_valid
    check (username ~ '^[A-Za-z0-9_]{3,32}$')
);
create unique index if not exists auth_username_map_username_lower_unique
  on public.auth_username_map (lower(username));
alter table public.auth_username_map enable row level security;
revoke all on public.auth_username_map from anon, authenticated;
-- No client-facing RLS policies. Only server-side service-role access.

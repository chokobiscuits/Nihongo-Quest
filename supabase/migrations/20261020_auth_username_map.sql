-- Username-to-Supabase Auth identity mapping.
-- Apply only as part of the complete multi-user authentication rollout.
-- This table must not be readable or writable by anon/authenticated clients.
create table if not exists public.auth_username_map (
  username text primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint auth_username_map_username_valid
    check (username ~ '^[A-Za-z0-9_]{3,32}$')
);
create unique index if not exists auth_username_map_username_lower_unique
  on public.auth_username_map (lower(username));
alter table public.auth_username_map enable row level security;
revoke all on public.auth_username_map from anon, authenticated;
-- No client-facing RLS policies. Only server-side service-role access.

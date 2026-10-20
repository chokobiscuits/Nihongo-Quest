# Multi-user Supabase Auth migration (work in progress)

## Current implementation
- `src/app/api/login/route.ts` validates `APP_USERNAME` and `APP_PASSWORD` (not Supabase Auth).
- `src/proxy.ts` accepts one shared HMAC session cookie.
- `src/lib/appUser.ts` exports one global `APP_USER_ID`; server actions and queries depend on it.
- `src/lib/db.ts` uses privileged Prisma/Postgres access; RLS is not enforced by that connection.
- `public.UserProfile` has one existing profile; preserve its data.

## Required changes before production deployment
1. Implement Supabase Auth username sign-in via a **server-only** mapping from unique usernames to Supabase Auth user identities. Do not use guessable synthetic email addresses as public login identifiers without rate limiting and account enumeration protection.
2. Create accounts using Supabase Auth Admin API from a secure one-time server-side provisioning script; never store plaintext passwords or put secrets in Git.
3. Replace the shared HMAC cookie with authenticated per-user sessions; guard all API routes, pages, server actions and queries.
4. Replace every `APP_USER_ID` usage with the verified session's user ID, including XP, reviews, resets, achievements, and progress. Do not trust user IDs from browser parameters.
5. Map the existing user's `APP_USER_ID` to a new auth identity without losing the existing `UserProfile` and related records.
6. Add per-user authorization tests, login/logout tests, cross-account isolation tests, and a rollback plan.
7. Provision requested usernames `Matthieu123`, `Lily123`, and `Eliane123` with separate IDs; require password change on first sign-in. Deliver credentials privately.
8. Configure Vercel environment variables securely, test preview deployment, then merge after review.

## Safety
Do not merge this planning-only branch: it does **not** implement multi-user authentication yet. Do not directly insert rows into `auth.users` with SQL; use the supported Supabase Auth Admin API.

# Deploying to Vercel

This app runs locally against a live Supabase Postgres database with no
auth. Before it can live on Vercel it needs three things it doesn't have
locally: a Storage-backed avatar driver (local disk doesn't persist on
Vercel), a password gate (Vercel deployments are public URLs), and a
rotated DB password (the one in local `.env` should not end up in a public
or shared deployment).

`.env` is never committed — it's gitignored, and stays that way. Everything
below is set directly in the Vercel dashboard (or `vercel env add`), not in
a file that ships with the repo. `.env.example` documents every variable
with placeholder values only.

## 1. Rotate the DB password

The current `DATABASE_URL` / `DIRECT_URL` password in local `.env` was used
during development and should not be reused in production.

1. Supabase dashboard → Project Settings → Database → Reset database
   password.
2. Update local `.env` with the new password if you want local dev to keep
   working against the same project (optional — copy the connection strings
   Supabase shows you, they already have the pooler host/port right).
3. Use the new password when setting `DATABASE_URL` / `DIRECT_URL` on Vercel
   (step 4).

## 2. Create the Supabase anon key

Supabase dashboard → Project Settings → API. Copy the `anon` `public` key.
This becomes `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If you want the avatar
uploader to use a service-role key instead (bypasses bucket policy checks,
slightly simpler for a single-user app), copy the `service_role` key too —
that's `SUPABASE_SERVICE_ROLE_KEY`, and it must **never** be prefixed
`NEXT_PUBLIC_` since it grants full access.

## 3. Create the `avatars` bucket

Supabase dashboard → Storage → New bucket.

- Name: `avatars` (must match `SUPABASE_STORAGE_BUCKET`, which defaults to
  `avatars` if you don't set it).
- Public bucket: yes. The app renders avatars as plain `<img src>` public
  URLs; there's no signed-URL flow.

## 4. Environment variables on Vercel

Project Settings → Environment Variables. Set these for Production (and
Preview if you want preview deployments to work against the same DB):

| Variable | Purpose | Where to find it |
|---|---|---|
| `DATABASE_URL` | Pooled (pgbouncer, port 6543) Postgres connection the app uses at runtime. | Supabase → Project Settings → Database → Connection string → Transaction pooler, after rotating the password in step 1. |
| `DIRECT_URL` | Direct connection (port 5432), used only for `prisma migrate`. Points at the pooler's session-mode port rather than the true direct host, because the direct host (`db.<ref>.supabase.co`) is IPv6-only and unreachable from networks without IPv6 egress — this includes most CI runners and some local networks. | Same Supabase connection string page, session pooler variant. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, used by the Storage driver. | Supabase → Project Settings → API → Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key; fallback credential for Storage if no service role key is set. | Supabase → Project Settings → API → anon public key (step 2). |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional. Preferred credential for the Storage driver if set — bypasses bucket policy checks. Server-only, never sent to the client. | Supabase → Project Settings → API → service_role key (step 2). |
| `SUPABASE_STORAGE_BUCKET` | Bucket name for avatar uploads. Defaults to `avatars` if unset. | Whatever you named the bucket in step 3. |
| `APP_USER_ID` | Names the single seeded `UserProfile` row this app operates on. | Already `local-user` — keep it unless you re-seed under a different id. |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployment, used in a couple of absolute-URL contexts. | Your Vercel deployment URL (or custom domain). |
| `APP_PASSWORD` | The single shared password gating the whole app. | Pick one yourself. |
| `APP_SESSION_SECRET` | HMAC signing key for the session cookie. Generate with `openssl rand -hex 32` (or any long random string) — treat it like a secret, rotate it to invalidate all sessions. | Generate it once, store it in Vercel and nowhere else. |
| `ANTHROPIC_API_KEY` | Optional. Only needed to run `npm run mnemonics:generate` for real; not required for the deployed app to function. | Anthropic console, if you use it. |
| `ANTHROPIC_MODEL` | Optional override for the above. | — |

Setting `APP_PASSWORD` and `APP_SESSION_SECRET` is what turns the password
gate on — see `src/proxy.ts` (Next 16's successor to `middleware.ts`; same
mechanism, renamed convention). Leave both unset and the app behaves exactly
as it does in local dev today: no login required.

## 5. Import the repo and deploy

1. Vercel → Add New → Project → import this repo.
2. Framework preset: Next.js (auto-detected). Build command and install
   command can stay default — `npm run build` already runs
   `prisma generate && next build` (see `package.json`), and `postinstall`
   also runs `prisma generate` as a second safety net for any install path
   that skips `build`.
3. Set the environment variables from the table above before the first
   deploy, or the build will fail on a missing `DATABASE_URL`.
4. Deploy.

## 6. Run migrations against production

Prisma migrations are not run automatically as part of the Vercel build —
only `prisma generate` is, which just regenerates the client from the
schema. Apply pending migrations from your machine, pointed at production,
before or right after the first deploy:

```
DATABASE_URL="<production DATABASE_URL>" DIRECT_URL="<production DIRECT_URL>" npx prisma migrate deploy
```

`prisma.config.ts` uses `DIRECT_URL` for migrations specifically because
pgbouncer (what `DATABASE_URL` points at) cannot run the DDL statements
migrations issue.

## 7. Seed

If this is a fresh database (not the existing dev database, which is
already seeded), run the seed scripts once against production the same way:

```
DATABASE_URL="<production DATABASE_URL>" DIRECT_URL="<production DIRECT_URL>" npm run seed:load
DATABASE_URL="<production DATABASE_URL>" DIRECT_URL="<production DIRECT_URL>" npm run seed:load-tutorials
```

If you're pointing production at the same Supabase project that's already
seeded (the common case here, since there's only one user), skip this step
entirely — do not re-run seed scripts against a database with real
progress in it.

## Notes on filesystem use

`public/uploads/` is a local-disk fallback only — see the comment at the
top of `src/lib/storage.ts`. It is **not** relied on in production: Vercel's
filesystem is ephemeral and read-only outside `/tmp` at request time, so
anything written there disappears (and may error) between invocations. The
Supabase Storage driver is what actually persists avatars once
`NEXT_PUBLIC_SUPABASE_URL` and a key are set; the local driver only exists
so avatar upload works today in local dev.

## PWA icons

`public/manifest.webmanifest` references `/icons/icon-192.png` and
`/icons/icon-512.png` for "Add to Home Screen" installs. Both exist under
`public/icons/`. Regenerate them if the brand mark changes — they're a
simple generated placeholder (torii-gate glyph on the brand violet), not
final art.

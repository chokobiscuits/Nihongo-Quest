# Operations: environment, seeding, migration, and traps

## Environment variables

Set these in `.env` locally or in the Vercel/hosting dashboard for production. None are committed to the repo.

| Variable | Purpose | Example | Required |
|---|---|---|---|
| `DATABASE_URL` | Supabase pooled connection (pgbouncer, port 6543). Used at runtime by the app. | `postgresql://user:pass@... /6543/postgres` | Yes |
| `DIRECT_URL` | Supabase session-mode pooler (port 5432, NOT the direct host). Used only by `prisma migrate`. Points to the pooler (not IPv6-only direct host) so migrations run from CI and most networks. | `postgresql://user:pass@... /5432/postgres` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for Storage. | `https://<project>.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public, safe to embed). Fallback credential for Storage. | (64 char hex string) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never sent to client). Preferred credential for Storage; bypasses bucket policies. | (64 char hex string) | No, but recommended |
| `SUPABASE_STORAGE_BUCKET` | Avatar bucket name. Defaults to `avatars` if unset. | `avatars` | No |
| `APP_USER_ID` | Names the single seeded `UserProfile` row. Trimmed to strip hosting-dashboard pasted whitespace. | `local-user` | No (defaults to `local-user`) |
| `NEXT_PUBLIC_APP_URL` | Public deployment URL. Used for absolute URL contexts. | `https://example.com` or `https://*.vercel.app` | No (only needed for some features) |
| `APP_PASSWORD` | Shared password gating the app. If unset, the gate is fully bypassed (local dev mode). | (any string) | No |
| `APP_SESSION_SECRET` | HMAC signing key for session cookies. Generate with `openssl rand -hex 32`. Rotate it to invalidate all sessions. Treated as a secret, stored only on the host. | (64 char hex string) | No |
| `ANTHROPIC_API_KEY` | Only needed to run `npm run mnemonics:generate` for real. | (Anthropic console) | No |
| `ANTHROPIC_MODEL` | Optional model override for mnemonic generation. | `claude-3-5-sonnet-20241022` | No |

**Important:** Unset or empty APP_PASSWORD disables the password gate entirely. Both APP_PASSWORD and APP_SESSION_SECRET must be set to enable authentication. See `src/proxy.ts`.

## First-time setup

### 1. Create Supabase project and database

1. Supabase dashboard → New project.
2. Wait for the database to be provisioned.
3. Go to Project Settings → Database.
4. Copy the connection strings for both `DATABASE_URL` (Transaction pooler, port 6543) and `DIRECT_URL` (Session pooler, port 5432).

### 2. Set up local `.env`

```bash
cp .env.example .env
# Edit .env and paste DATABASE_URL / DIRECT_URL from Supabase
```

### 3. Run migrations and seed

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed:download    # ~13MB of compressed data, cached after first run
npm run seed:transform   # Pure parsing, produces data/processed/*.jsonl
npm run seed:load        # Upserts into Postgres
npm run seed:load-tutorials  # Hand-encoded tutorials
```

### 4. Run locally

```bash
npm run dev
# http://localhost:3000 (no password gate locally unless APP_PASSWORD is set)
```

## Production deployment on Vercel

See `docs/deployment.md` for the full checklist: rotating the database password, creating the Storage bucket, setting every env var, running migrations against production, and seeding if needed.

## Seed and load commands

All seed commands require `DATABASE_URL` and `DIRECT_URL`.

```bash
# Download sources (one-time, cached)
DATABASE_URL=... DIRECT_URL=... npm run seed:download

# Parse and transform (pure, produces data/processed/*.jsonl)
npm run seed:transform

# Load from JSONL into Postgres (idempotent, upserts on slug)
DATABASE_URL=... DIRECT_URL=... npm run seed:load

# Load hand-authored tutorials (idempotent, separate from the three-phase pipeline)
DATABASE_URL=... DIRECT_URL=... npm run seed:load-tutorials
```

Safe to re-run: the load phase upserts on `(parentId, childId)` for components and `slug` for subjects, so duplicate runs produce the same rows. User-authored fields are never overwritten.

## Migrations

```bash
# Against local dev database (uses DATABASE_URL)
npx prisma migrate dev --name <description>

# Against production (uses DIRECT_URL)
DATABASE_URL="<prod DATABASE_URL>" DIRECT_URL="<prod DIRECT_URL>" npx prisma migrate deploy
```

Migrations use `DIRECT_URL` (session pooler) because pgbouncer (what `DATABASE_URL` points to) cannot run DDL statements. Both URLs point to the pooler, never the direct host, because the direct host is IPv6-only and unreachable from most CI runners and networks without IPv6 egress.

## Mnemonic generation

```bash
npm run mnemonics:generate -- --type=KANJI --level=1 --limit=10 --yes
```

Only uses the Anthropic API (required: `ANTHROPIC_API_KEY`). Does not read or write any SRS, XP, session, or tutorial data. Writes only `Subject.meaningMnemonic`, `readingMnemonic`, and `mnemonicSource`.

Flags:
- `--type=KANJI|RADICAL|VOCAB|GRAMMAR|KANA`: Scope to one type (default: all).
- `--level=N`: Scope to curriculum level N.
- `--limit=N`: Cap the number processed.
- `--regenerate`: Also rewrite `mnemonicSource="generated"` (never rewrites `"authored"`).
- `--dry-run`: Print prompts and responses, write nothing.
- `--mock`: Use deterministic mock client instead of real API.
- `--yes`: Skip cost confirmation.

Resumable: already-written rows are not reselected, so re-running picks up where it left off.

See `scripts/mnemonics/README.md` for prompts, cost estimates, and the authored-vs-generated contract.

## Simulator harness

```bash
npm run sim
```

Drives a synthetic user (`sim-test-user`) through the full curriculum mechanically, exercising:
- Unlock chain (kana gate, component gating, type unlock, curriculum levels).
- SRS transitions (promotion, demotion, 4-hour cap).
- XP, level, rank, mastery calculations.
- Streak and daily rollover.
- Deferred-write guarantee (all changes in one transaction, or none).

**Safety:** Never touches `local-user`. Every write goes through `sim-test-user` (passed explicitly to all queries/actions). All of sim-test-user's rows are deleted at the end, pass or fail, via a finally block.

Prints a test report with check results. Exits non-zero if any check fails.

See `scripts/sim/progression.ts`.

## Known operational traps

### Whitespace in hosting dashboards

Pasting env var values into Vercel, Supabase, or other dashboards often picks up leading/trailing whitespace. For `APP_PASSWORD` and `APP_SESSION_SECRET`, this simply silences the gate or causes session mismatches. For `APP_USER_ID`, it's worse: an untrimmed id creates a *different* user row (e.g., `\tlocal-user` vs. `local-user`), and the app silently shows a blank profile while the real progress sits untouched under the correctly-trimmed id.

**Mitigation:** `APP_USER_ID` is normalized by `src/lib/appUser.ts`, which trims and defaults to `"local-user"`. Always trim manually in hosting dashboards.

### Next.js 16 routing: middleware.ts to proxy.ts

The Next 16 App Router moved from `middleware.ts` to a `proxy` function exported from any file and declared in `next.config.js`. This app uses `src/proxy.ts`. It is not a middleware.ts file.

### Supabase: IPv6-only direct host

The Supabase "direct" host (db.*.supabase.co) is IPv6-only and unreachable from networks without IPv6 egress (most CI runners, some local networks). Both `DATABASE_URL` and `DIRECT_URL` point to Supabase's pooler (pgbouncer) instead, which is IPv4-accessible. The pooler session-mode port (5432) works for migrations; the transaction-mode port (6543) works for app runtime queries.

### Supabase Storage: service role key for writes

The anon key cannot write to Storage (only read). Use `SUPABASE_SERVICE_ROLE_KEY` for the upload driver. See `src/lib/storage.ts` for the fallback chain and `docs/deployment.md` for which env var to set.

### Vercel filesystem is ephemeral

`public/uploads/` is a local-disk fallback only. Vercel's filesystem is read-only outside `/tmp` at request time and ephemeral between invocations. Avatar upload persists to Supabase Storage (not the local disk). See the comment at the top of `src/lib/storage.ts`.

## Testing and validation

```bash
npm test              # vitest: src/services/** only
npm run typecheck     # tsc --noEmit
npm run sim           # mechanical progression (safe, uses sim-test-user)
```

All pure logic is tested. The simulator exercises end-to-end flows without touching the real user.

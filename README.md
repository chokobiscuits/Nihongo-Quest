# Nihongo Quest

A single-user Japanese learning app powered by spaced repetition (SRS). Learn radicals, kanji, vocabulary, grammar points, and sentences on a self-paced curriculum ladder. No daily caps, no artificial delays. Account level and XP rank sit atop per-type curriculum levels.

## Stack

Next.js 16 (App Router), TypeScript, Prisma 7, Supabase Postgres, Tailwind v4. Deployed on Vercel behind a shared password gate.

## Quick start

```bash
npm install
cp .env.example .env
# Fill in DATABASE_URL and DIRECT_URL from Supabase
npx prisma generate
npm run dev
```

First-time setup against a fresh Supabase database:

```bash
npx prisma migrate dev --name init
npm run seed:download
npm run seed:transform
npm run seed:load
npm run seed:load-tutorials
```

See `docs/deployment.md` for production setup and `docs/operations.md` for every environment variable and seed/migration command.

## Testing

```bash
npm test                # vitest, src/services/** only
npm run typecheck       # tsc --noEmit
npm run sim             # mechanical progression simulator (safe, uses sim-test-user)
```

The pure business logic in `src/services/**` has zero database access and is unit tested. The simulator exercises real code paths end-to-end.

## Content

Seeded from public sources: KANJIDIC2, JMdict, JmdictFurigana, KanjiVG, KRADFILE, Tatoeba. Hand-authored: 214 Kangxi radicals, 107 grammar points, 208 kana. See `docs/content.md` for sources, licenses, and current counts.

Seeded content is CC BY-SA and kept separate from user-authored mnemonics and hints via the schema's USER-AUTHORED block (see `prisma/schema.prisma`).

## Architecture

Read `docs/architecture.md` for the shape of the system: the polymorphic Subject model, SubjectComponent unlock graph, per-type curriculum levels, pure-services boundary, and deferred-write sessions.

## SRS

Read `docs/srs.md` for the ten stages, correct/incorrect transitions, the 4-hour promotion cap, unlock rules, XP, level curve, ranks, and mastery.

## Project layout

```
src/
  app/              Routes (Next.js App Router).
  server/
    queries/        Database read queries.
    actions/        Database mutations (called from the client).
  services/         Pure business logic, zero DB access, unit tested.
    srs/            Stages, transitions, unlock rules, curriculum levels.
    xp/             XP curve, account levels, ranks, mastery.
    furigana/       Furigana rendering and visibility.
    answer/         Answer grading and normalization.
    lessons/        Lesson batching logic.
    reviews/        Review queue and question type selection.
    tutorials/      Tutorial trigger logic.
    progress/       Display/visibility rules.
    achievements/   Achievement definitions.
  lib/
    db.ts           Prisma client via pg driver adapter.
    auth.ts         Password gate token logic.
    storage.ts      Avatar upload to Supabase Storage.
    appUser.ts      Normalized APP_USER_ID.
  proxy.ts          Next 16 request middleware (password gate).
prisma/
  schema.prisma     Data model.
scripts/
  seed/             Content pipeline: download, transform, load.
  mnemonics/        LLM-driven mnemonic generation.
  sim/              Simulator harness for testing.
```

## Deployment

See `docs/deployment.md`. Vercel setup includes password gate (optional), avatar bucket, Supabase env vars, and migration commands. The gate is disabled if APP_PASSWORD is unset.

## Known operational traps

Whitespace pasted into hosting dashboards breaks both login and APP_USER_ID (see `src/lib/appUser.ts`). Next 16 uses `src/proxy.ts`, not `middleware.ts`. Supabase's direct host is IPv6-only; both DATABASE_URL and DIRECT_URL point to the pooler. Supabase Storage needs the service role key for writes since the anon key cannot write.

See `docs/operations.md` for env vars, seed/load commands, mnemonic generation, simulator details, and these traps in full.

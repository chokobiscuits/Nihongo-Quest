# Choko Japan

A single-user Japanese learning platform: SRS-driven lessons and reviews over
radicals, kanji, vocab, grammar, sentences, and reading passages, with an XP
and rank system layered on top.

Single user by design: no auth, no RLS. Everything in the database belongs to
the one person running this instance.

## Stack

Next.js (App Router) - TypeScript - Tailwind - Prisma 7 - Supabase Postgres.

## Setup

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL / DIRECT_URL from your Supabase project
npx prisma generate
npx prisma validate
npm run dev
```

Migrations are not part of this repo's initial state — no `prisma migrate`
has been run against a live database yet. Once you have real Supabase
credentials in `.env`, run:

```bash
npx prisma migrate dev --name init
```

## Tests

```bash
npm test          # vitest, pure logic only, no database
npm run typecheck  # tsc --noEmit
```

The SRS, XP, and furigana-visibility logic in `src/services` is pure
(no DB access) and fully unit tested.

## Content licensing

Seeded dictionary and kanji content (JMdict/JMdictFurigana, KanjiVG, and
similar sources) is licensed under **CC BY-SA** and is used here with
attribution. The `/about` page and the `DataSource` table list every source,
its license, and the required attribution text.

The Prisma schema keeps that seeded content separate from the user's own
writing: `Subject.meaningMnemonic`, `readingMnemonic`, `meaningHint`,
`readingHint`, and `acceptedMeanings` are user-authored fields, clearly
grouped and commented in `prisma/schema.prisma`, and are never written by a
seed script. Any future export of the seeded library can select every other
column and skip these, so personal notes are never bundled into something
redistributed under CC BY-SA.

## Project layout

```
src/
  app/            Routes (App Router). Placeholder pages only so far.
  services/       Pure business logic, unit tested, zero DB access.
    srs/          Stage table, review transitions, unlock rules.
    xp/           XP curve, level curve, rank bands, mastery.
    furigana/     Furigana rendering from JmdictFurigana-shaped data.
    progress/     Display/visibility rules (e.g. furigana show/hide).
  lib/
    db.ts         Prisma client via the pg driver adapter.
prisma/
  schema.prisma   Data model.
```

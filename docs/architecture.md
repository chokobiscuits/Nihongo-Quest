# Architecture

## The polymorphic Subject model

Six content types share a single `Subject` table: KANA, RADICAL, KANJI, VOCAB, GRAMMAR, SENTENCE. (READING exists in the enum but has zero rows and is rendered as coming soon.)

This consolidation is deliberate: it keeps the unlock graph uniform (SubjectComponent edges work the same for all types), makes progress tracking consistent (every type has a UserSubject row with SRS stage), and simplifies curriculum level assignment (one per-type rule, applied to all six).

Each type is queried and displayed separately, but the underlying model is unified.

## SubjectComponent and the unlock graph

`SubjectComponent` is a directed edge: parent depends on child. Examples: a kanji depends on its radicals, a vocabulary word depends on its kanji, a sentence depends on its vocabulary.

### The gating rule

**A Subject unlocks once every one of its gating components has reached Guru (SRS stage 5 or above).**

The `isGating` field on `SubjectComponent` distinguishes two kinds of edges:

- **Gating (default true)**: These edges block unlock. A kanji cannot be reviewed until its radicals are Guru'd. A vocabulary word cannot be reviewed until its kanji are Guru'd. A sentence cannot be reviewed until its vocabulary is Guru'd.
- **Non-gating (isGating = false)**: These edges exist for UI linking and highlighting but never block unlock. Every sentence has edges to its vocabulary, but only the *content words* (nouns, verbs, adjectives, adverbs) gate the sentence. Function words (particles, copula, auxiliaries, conjunctions, pronouns, counters, interjections) are marked non-gating, so a sentence can unlock even if the user hasn't learned every particle in it. This prevents the pathological case where a single unlearned particle locks hundreds of sentences.

Radicals are special: they have no incoming edges and are additionally gated only by the kana gate (see below) and the user's account level (level 1 for the first radicals, then level-based unlock for later ones).

### The kana gate

Radicals unlock only after the user has resolved every kana subject: either passed (reached Guru, stage 5+) or skipped (the "I already know kana" flow burns every kana subject to stage 9 instantly). A user with zero kana subjects at all is considered unresolved; the gate must be actively passed or skipped, never just absent. This is implemented in `src/services/srs/kana-gate.ts` and checked by `isSubjectUnlocked` in `src/services/srs/unlock.ts`.

## Per-type curriculum levels vs. account level

**These are deliberately separate.**

**Account level** (stored in `UserProfile.accountLevel`, derived from total XP via the level curve) drives rank and cosmetics. It progresses continuously as the user earns XP.

**Per-type curriculum levels** (derived from progress, never stored) track mastery per subject type. Each type advances independently once 90% of the current level's subjects have reached Guru. Examples:
- User is at KANJI level 5, VOCAB level 3, RADICAL level 7.
- A KANJI subject at curriculum level 6 is not unlocked yet (user hasn't completed level 5).
- A VOCAB subject at curriculum level 4 is not unlocked yet (user hasn't completed level 3).

Account level and curriculum level are orthogonal gating rules. See `src/services/srs/curriculum.ts` for how curriculum levels are computed and `src/services/srs/unlock.ts` for how they're used in the unlock check.

## Type-level unlocking

In addition to curriculum levels and component gating, each SubjectType has a soft gate based on Guru counts of prerequisite types. These are tracked in `src/services/srs/typeUnlock.ts`:

| Type | Unlock requirement | Threshold |
|---|---|---|
| KANA | None (always unlocked) | N/A |
| RADICAL | Kana gate (see above) | N/A |
| KANJI | Guru at least 10 radicals | 10 |
| VOCAB | Guru at least 10 kanji | 10 |
| SENTENCE | Guru at least 50 vocabulary | 50 |
| GRAMMAR | Guru at least 50 vocabulary | 50 |
| READING | Guru at least 20 grammar points | 20 |

Locked types stay visible and browsable; they simply contribute no lesson items. See `src/server/queries/lessons.ts` for how this filters the lesson batch.

## Pure services boundary

`src/services/**` is pure: zero database access. Every file in this directory:
- Takes raw input (numbers, enums, plain objects).
- Returns deterministic output (same input always produces same output).
- Is fully unit tested without needing a database.

This includes:
- `srs/`: Stage table, transitions, unlock logic, curriculum level derivation.
- `xp/`: XP rewards, level curve, rank bands, mastery calculation.
- `answer/`: Answer grading, normalization, kana romaji variants.
- `lessons/`: Lesson batch creation logic.
- `reviews/`: Review queue sorting, question type selection.
- `furigana/`: Ruby markup rendering.
- `progress/`: Visibility rules (e.g., when to show furigana).
- `tutorials/`: Trigger logic.
- `achievements/`: Achievement checks.

Queries (`src/server/queries/**`) and actions (`src/server/actions/**`) are the only layer with database access. They call these pure services to do their decision-making, then persist the results.

## Deferred writes in sessions

Lesson and review sessions (`Session` table) hold state in memory and commit in a single transaction at the end via `commitLessonSession` and `commitReviewSession` in `src/server/actions/`.

If a session is abandoned mid-way (browser closed, network lost), no data is written. UserSubject rows are never partially updated. This keeps the database consistent and prevents "ghost progress" from incomplete sessions.

Each session has a `scope` field (JSON, shape varies by kind) to record what was in play (subject ids, level range, etc.) for reporting and replay if needed.

# SRS System

## The ten stages

Stage 0 (Lesson) is the starting point after a subject unlocks. Stages 1-9 form the review ladder:

| Stage | Name | Interval after correct |
|---|---|---|
| 0 | Lesson | 0 (immediate) |
| 1 | Apprentice I | 4 hours |
| 2 | Apprentice II | 8 hours |
| 3 | Apprentice III | 1 day |
| 4 | Apprentice IV | 2 days |
| 5 | Guru I | 7 days |
| 6 | Guru II | 14 days |
| 7 | Master | 30 days |
| 8 | Enlightened | 120 days |
| 9 | Burned | null (never due again) |

See `src/services/srs/stages.ts`.

## Transitions: correct and incorrect

All transitions are computed in `src/services/srs/transition.ts` via `computeTransition(stage, correct, incorrectCount, now, lastPromotedAt)`.

### Correct answer

- If promotion is not blocked by the 4-hour cap (see below): advance one stage, up to stage 9 (Burned). Set `dueAt` to now plus the new stage's interval.
- If promotion is blocked: stay at the same stage, set `dueAt` as if the stage were correct, but mark `promoted = false`. XP and mastery still apply.

### Incorrect answer

Drop the stage by `ceil(incorrectCount / 2) * penaltyFactor`, minimum stage 1.

Below Guru the penalty factor is always 1. At Guru and above (stage 5+) it is 2 by default, because losing long-term-review status is more expensive than losing a fresh Apprentice item. Examples:
- Apprentice II (stage 2), 1 wrong: drop to stage 1.
- Apprentice III (stage 3), 3 wrongs: `ceil(3/2) = 2`, drop 2 stages to stage 1.
- Master (stage 7), 1 wrong: `penaltyFactor = 2`, drop 2 stages to stage 5 (Guru I).
- Enlightened (stage 8), 2 wrongs: `ceil(2/2) * 2 = 2`, drop 2 stages to stage 6 (Guru II).

Demotion happens immediately; XP is awarded regardless of correctness.

#### Mastery-softened demotion

The Guru+ doubling is waived for an item with a clean history, so a well-learned item loses one stage on a miss instead of two. At Enlightened that is the difference between dropping to Master and dropping to Guru II, which is 120 days of interval rather than 134.

"Clean" is `masteryXp / cleanClimbMasteryXp(stage)`, where the denominator is the mastery XP an item would hold if it had climbed to its current stage without a single miss. A flawless item sits at exactly 1.0; one missed once early sits near 1.5; one that has bounced between stages for a dozen reviews sits near 3.0. At or below `CLEAN_HISTORY_RATIO` (1.6) the penalty is 1, otherwise 2.

The ratio, not raw `masteryXp`, carries the signal. Raw mastery XP rises with volume, and a struggling item accumulates *more* of it than a clean one precisely because it keeps coming back: a shaky item at Guru I can hold 132 XP against a flawless item's 45. Comparing against the clean-climb baseline is what turns that into a usable measure. A threshold on raw `masteryXp` would have rewarded failure.

`masteryXp` is optional on `TransitionInput`; omitting it falls back to the flat stage-based penalty.

**Warning:** `CLEAN_HISTORY_RATIO` is an untested guess, the same caveat that applies to the 4-hour promotion cap below. It was chosen to sit above a single early miss (~1.5) and below a chronically shaky item (~2.9), but it has not been validated against learner data. Instrument the distribution of the ratio at demotion time before tuning it.

Note also what the ratio cannot see: `masteryXp` measures accumulated correct volume, not current knowledge. An item learned well months ago and since forgotten still carries a low ratio and receives the softer penalty on exactly the miss that deserves the harsher one. Weighting recent `ReviewLog` entries instead would fix this at the cost of a heavier query.

## The 4-hour promotion cap

**What it blocks:** Upward stage movement. A correct answer within 4 hours of the last promotion stays at the current stage.

**What it does not block:**
- Demotion on an incorrect answer.
- Queue ordering via `dueAt` (the item is still scheduled to come due at the computed time).

**What it scales down:** XP and mastery for a correct answer whose promotion
was blocked are multiplied by `UNPRODUCTIVE_REVIEW_XP_FACTOR` (0.1, floored at
1 XP). Without this, the cooldown itself could be exploited by cycling items
between ranked (due-filtered) and unranked (unfiltered) practice queues. The
unranked queue's practice cap is the primary defense; the XP scaling is
secondary. Incorrect answers keep their flat participation award. See
`scaleXpForProductivity` in `src/services/xp/curve.ts`.

**Implementation:** `lastPromotedAt` is stored per UserSubject and updated only when `promoted = true`. `isPromotionBlocked(lastPromotedAt, now)` checks if now is within 4 hours of `lastPromotedAt`. See `src/services/srs/transition.ts`.

**Warning:** The 4-hour figure is not validated against learner behavior data. It is an untested guess. If you deploy this, instrument promotion patterns to see if the cap is too tight (users skip items to avoid the cap) or too loose (users game it by reviewing too quickly).

## Ranked and unranked reviews

There are two review modes.

**Ranked** (`/reviews`) is the SRS proper. The queue is filtered to items that are actually due (`dueAt <= now`), so a session is finite and completable: you clear what's due and you're done. This is the only mode that awards mastery or moves an item's SRS stage. It awards XP and LP. When nothing is due the page says so and shows how long until the next item comes up.

**Unranked** (`/reviews/practice`) is free practice. Pick any subject types and curriculum levels you've unlocked and drill them regardless of due date. It awards capped XP only (1 per correct, hard cap of 150/day) and no mastery. It never changes `srsStage`, `dueAt`, or `lastPromotedAt` — it cannot promote *or* demote. It never awards LP. Answers are still written to `ReviewLog` (with `startedStage == endedStage`) and the per-item correct/incorrect counters still update, so accuracy stats stay honest.

The split exists because an unfiltered queue does not scale: with a few hundred started items, every session serves the entire collection and the queue can never empty. The practice cap and lack of LP award remove the exploit, since the only mode that drives rank is the one you cannot re-enter at will.

See `getReviewQueue` / `getUnrankedReviewQueue` in `src/server/queries/reviews.ts` and `commitReviewSession` / `commitUnrankedReviewSession` in `src/server/actions/reviews.ts`.

## Unlock rules per type

See `src/services/srs/unlock.ts` for the complete logic.

**KANA:** Unlocks purely on account level (level 1 for first kana, all kana at once). No component gating.

**RADICAL:** Same level-based unlock as KANA, plus the kana gate (every kana must be passed or skipped before any radical unlocks).

**KANJI, VOCAB, GRAMMAR, SENTENCE:** Unlock when:
1. All gating components are at Guru (stage 5+).
2. The subject's curriculum level is at or below the user's current level for that type.
3. The subject's type is type-unlocked (e.g., VOCAB needs Guru on at least 10 kanji).

Function-word vocabulary in sentences are non-gating (isGating = false) and never block the sentence.

**READING:** Zero rows seeded. Stub status only.

## Kana gate

Radicals cannot be learned until the user resolves kana: either passes all kana subjects (reaches Guru on every one) or skips them outright (burns every kana subject to stage 9). This is a pre-curriculum gate independent of curriculum levels. See `src/services/srs/kana-gate.ts`.

## Type-unlock thresholds

Soft gates; locked types stay visible and browsable but don't appear in lesson batches.

- KANJI: 10 radicals at Guru.
- VOCAB: 10 kanji at Guru.
- SENTENCE: 50 vocabulary at Guru.
- GRAMMAR: 50 vocabulary at Guru.
- READING: 20 grammar points at Guru.

See `src/services/srs/typeUnlock.ts` for the constants and the status UI.

## XP and levels

See `docs/progression.md` for the complete XP and account level system. Summary: account level is a pure function of total XP via an unbounded, sublinear curve. XP awards are: 25 for lessons, 8 + 3*srsStage for correct ranked reviews (scaled to 10% if blocked by the 4-hour cooldown), 2 for incorrect, and 1 per correct unranked practice answer (capped at 150/day). Streak multiplier (+2% per day, capped at 1.5x) applies to ranked reviews only.

See `src/services/xp/curve.ts` for the constants and formulas. The level cost table is printed by `npm run curve-report`.

## Ranks (LP-driven)

Rank is independent of account level and is driven by LP (League Points), not XP. See `docs/progression.md` for the complete LP system.

Nine tiers (IRON through CHALLENGER, in order). The first six are divided into four divisions each (IV lowest, I highest). MASTER and above share one unbounded LP pool with no divisions.

A user starts at IRON IV with 0 LP. Tiers are never lost — at division IV, LP floors at 0 and prevents demotion out of the tier. Apex tiers (MASTER+) have no demotion risk at all.

Only ranked reviews and exams move LP. Lessons and unranked practice do not.

See `src/services/rank/lp.ts` and `src/services/rank/tiers.ts`.

## Mastery

Per-subject mastery: 5 + 2 * srsStage XP per correct answer (never decreases, unlike SRS stage which can drop). Mastery level = floor(sqrt(masteryXp / 25)).

Account mastery: sum of all UserSubject.masteryXp, scaled 10x wider (floor(sqrt(total / 250))) so the level curve matches the item curve's shape. Unbounded.

Mastery tiers (Unranked, Novice, Apprentice, ..., Transcendent) map to these levels, rendered in the UI. See `src/services/xp/mastery.ts`.

## Curriculum levels (per-type progression)

Separate from account level. Each type (KANA, RADICAL, KANJI, VOCAB, SENTENCE, GRAMMAR) advances independently:

**A type's level advances when 90% of that type's current-level subjects reach Guru.**

These levels are derived (never stored) and queried on demand via `curriculumLevel(levelGuruStats)` in `src/services/srs/curriculum.ts`. Levels are contiguous (level 1 -> 2 -> 3, never skipping), walking in order from 1.

A subject at curriculum level 7 is not unlocked until the user's current level for that type is at least 7.

## Review queue ordering and filtering

See `src/services/reviews/queue.ts` and `src/server/queries/reviews.ts`.

The ranked queue selects only due items (`dueAt <= now`, or a null `dueAt`, which is a data anomaly worth surfacing rather than hiding), ordered by `dueAt` ascending. The returned items are then shuffled so sessions don't present the same order every time. The unranked queue skips the due filter entirely and instead narrows by the type/level filter the user picked.

Question type selection (MEANING vs. READING) is governed by `questionKindsFor(type)` in `src/services/reviews/queue.ts`. Radicals and kana ask meaning only (they have no real pronunciations). Everything else asks both, selected randomly within a session with the constraint that both types must be asked at least once per session if the subject is not single-type.

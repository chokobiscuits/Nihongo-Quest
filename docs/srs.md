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

The penalty factor changes at Guru (stage 5+): it doubles the demotion cost because losing long-term-review status is more expensive than losing a fresh Apprentice item. Examples:
- Apprentice II (stage 2), 1 wrong: drop to stage 1.
- Apprentice III (stage 3), 3 wrongs: `ceil(3/2) = 2`, drop 2 stages to stage 1.
- Master (stage 7), 1 wrong: `penaltyFactor = 2`, drop 2 stages to stage 5 (Guru I).
- Enlightened (stage 8), 2 wrongs: `ceil(2/2) * 2 = 2`, drop 2 stages to stage 6 (Guru II).

Demotion happens immediately; XP is awarded regardless of correctness.

## The 4-hour promotion cap

**What it blocks:** Upward stage movement. A correct answer within 4 hours of the last promotion stays at the current stage.

**What it does not block:**
- Demotion on an incorrect answer.
- Queue ordering via `dueAt` (the item is still scheduled to come due at the computed time).

**What it scales down:** XP and mastery for a correct answer whose promotion
was blocked are multiplied by `UNPRODUCTIVE_REVIEW_XP_FACTOR` (0.1, floored at
1 XP). Because the queue never filters by `dueAt`, the same items are always
re-servable, so without this an item could be reviewed back-to-back
indefinitely at full XP. Incorrect answers keep their flat participation
award. See `scaleXpForProductivity` in `src/services/xp/curve.ts`.

**Implementation:** `lastPromotedAt` is stored per UserSubject and updated only when `promoted = true`. `isPromotionBlocked(lastPromotedAt, now)` checks if now is within 4 hours of `lastPromotedAt`. See `src/services/srs/transition.ts`.

**Warning:** The 4-hour figure is not validated against learner behavior data. It is an untested guess. If you deploy this, instrument promotion patterns to see if the cap is too tight (users skip items to avoid the cap) or too loose (users game it by reviewing too quickly).

## Ranked and unranked reviews

There are two review modes.

**Ranked** (`/reviews`) is the SRS proper. The queue is filtered to items that are actually due (`dueAt <= now`), so a session is finite and completable: you clear what's due and you're done. This is the only mode that awards XP and mastery or moves an item's SRS stage. When nothing is due the page says so and shows how long until the next item comes up.

**Unranked** (`/reviews/practice`) is free practice. Pick any subject types and curriculum levels you've unlocked and drill them regardless of due date. It awards no XP and no mastery, and it never changes `srsStage`, `dueAt`, or `lastPromotedAt` — it cannot promote *or* demote. Answers are still written to `ReviewLog` (with `startedStage == endedStage`) and the per-item correct/incorrect counters still update, so accuracy stats stay honest.

The split exists because an unfiltered queue does not scale: with a few hundred started items, every session serves the entire collection and the queue can never empty. It also removes the XP exploit at the root, since the only mode that pays is the one you cannot re-enter at will.

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

**XP events** are tracked as a log in the XpEvent table, keyed by session and reason (lesson, review, streak multiplier, etc.). The UI derives total XP from UserProfile.totalXp.

**XP rewards:**
- Lesson (stage 0 to 1): 25 XP, flat (learning is the highest-value act).
- Correct review: 8 + 3 * srsStage XP. (Apprentice I: 11 XP; Enlightened: 32 XP.) Scaled to 10% (min 1 XP) if the 4-hour cooldown blocked the promotion.
- Incorrect review: 2 XP (participation reward, not stage-scaled).
- Streak multiplier: +2% per consecutive day active, capped at 1.5x at 25+ days. Applied to the session's total.

See `src/services/xp/curve.ts` for the constants and formulas.

**Account level** progresses via an XP curve: quadratic early (levels 1-24), then linear (levels 25+), with a floor so no level costs less than ~160 XP. The inflection at level 24 smooths the transition. See `src/services/xp/curve.ts` for `xpForLevel(level)` and `levelFromTotalXp(totalXp)`.

## Ranks

Eight tiers (IRON through CHALLENGER) covering levels 1-100+:

| Tier | Levels | Divisions | Notes |
|---|---|---|---|
| IRON | 1-4 | IV to I | Lowest |
| BRONZE | 5-12 | IV to I | |
| SILVER | 13-22 | IV to I | |
| GOLD | 23-34 | IV to I | |
| PLATINUM | 35-48 | IV to I | |
| DIAMOND | 49-64 | IV to I | |
| MASTER | 65-79 | None | No divisions |
| GRANDMASTER | 80-99 | None | |
| CHALLENGER | 100+ | None | Open-ended |

Each divided tier splits evenly into four divisions (IV, III, II, I); remainders go to I. Levels 0 or below clamp to IRON IV. See `src/services/xp/rank.ts`.

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

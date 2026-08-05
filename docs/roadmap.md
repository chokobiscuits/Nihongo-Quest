# Roadmap: deliberately unbuilt and gaps

## Deliberately not built

These are design decisions, not oversights.

### Exams

No exam mode or test feature is implemented. The entire app is built on continuous learning (lessons and spaced-repetition reviews), not on time-bounded exams or checkpoints. The Session table has `EXAM` as an enum value but it is never instantiated, and `src/services/rank/lp.ts` carries an exam LP multiplier that nothing currently invokes.

Note that `src/app/exams/page.tsx` ships as a placeholder route rendering "Exam sessions coming soon." The route exists; the feature does not.

### Audio

No pronunciation recordings. The app teaches reading (how to parse text, what words mean) and writing (how to input text), not listening or speaking. All examples are written text with furigana alignment.

This is separate from the UI sound kit in `public/sounds/`, which is interface feedback (correct/wrong answer, level-up, promotion, achievement) and contains no spoken Japanese.

### Text readings (読解)

Deliberately not built (not an oversight). The `READING` SubjectType exists in the schema with zero rows and is rendered as coming soon. See `docs/text-readings.md` for the investigation: Aozora Bunko (public domain, well-structured ruby) was rejected on content difficulty grounds (Meiji/Taisho-era texts with archaic vocabulary and grammar are not appropriate for learners still in early curriculum levels). When revisited, hand-written graded passages (4-8 sentences each, deliberate vocabulary reuse per level) would be better than automated scraping.

## Content authoring backlog

Real numbers, not approximations. Derived from the schema's content sources and the level-heuristic quota constants.

| Type | Total seeded | Ladder target | Ladder actual | Unladdered | Status |
|---|---|---|---|---|---|
| KANA | 208 | 208 | 208 | 0 | Done |
| RADICAL | 214 | ~192 | 192 | 22 | Done |
| KANJI | 10,384 | ~1,980 | 1,980 | 8,404 | Done |
| VOCAB | 29,911 | 5,225 | 5,225 | 24,686 | Done |
| SENTENCE | 7,705 | 3,600 | 3,600 | 4,105 | Done |
| GRAMMAR | 107 | 107 | 107 | 0 | Done |

The "ladder target" column shows the intended size at the quota rates in `scripts/seed/lib/level-heuristic.ts` (`SENTENCE_PER_LEVEL` × `LEVEL_COUNT`, and so on). The "ladder actual" is what's currently on the ladder. Counts are derived from `data/processed/subjects.jsonl` by whether a subject carries a non-null `level`.

Every type is laddered to target. Unladdered rows are not a gap and not lost: they are seeded and browsable, just not on the curriculum ladder. The seeded pool is deliberately much larger than the ladder for every corpus-sourced type (10,384 kanji seeded vs ~1,980 laddered, 29,911 vocab vs 5,225, 7,705 sentences vs 3,600) — the ladder is a curated slice, not an authoring shortfall.

VOCAB's target is below `VOCAB_PER_LEVEL * LEVEL_COUNT` (5,400) on purpose: levels 1-3 run reduced quotas because kanji-bearing vocab does not exist that early in the ladder, and filling those levels to the full quota meant scraping up kana-only filler. See the beginner coverage section in `docs/content.md`.

### Sentence ladder sizing and selection

Sentences were previously listed here as a 23% authoring gap against a 7,705 target. That was a documentation error: the target column had copied the total seeded count rather than deriving from the quota, and the ladder was already quota-full at `SENTENCE_PER_LEVEL = 30` × 60 levels = 1,800.

`SENTENCE_PER_LEVEL` is now 60 (3,600 laddered). Measured against the corpus, the eligible pool is far larger than any workable quota — ~1,291 sentences are eligible at level 1 alone — so quota values from 30 through 100 all fill every level with no starvation. 130 is the first value that starves levels; 7,593 is the hard ceiling (112 sentences have a min-eligible level above 60 and can never be placed).

Because the pool so far exceeds the quota, *which* sentences get picked matters more than how many. Selection now prefers a per-level length band (`sentenceLengthCeiling`, widening from 12 to 32 characters across the ladder) and orders within it by coarse length bucket, falling back to corpus order. A strict shortest-first sort was tried first and rejected: it drove every laddered sentence to ≤13 characters with no variety anywhere on the ladder.

**Known limit:** this yields a genuinely easy start (level 1 mean 8.2 characters vs 16.9 unsorted) but only weak progression (level 60 mean 17.1). Tatoeba has little length-vs-difficulty correlation to extract — median length runs 14 characters among level-1-eligible sentences vs 17 among level 41-60, and 79% of the corpus is ≤20 characters. Real difficulty progression needs a signal other than sentence length, and likely a different corpus. Length is a proxy for difficulty, not a measure of it.

## Tutorials

All 21 tutorial bodies are written. They live as a hand-encoded constant in `scripts/seed/lib/tutorials.ts` (not as separate markdown files), loaded by `scripts/seed/load-tutorials.ts`. The tutorial system (trigger logic, completion tracking, UI) is fully built. See `src/services/tutorials/` for the infrastructure.

Tutorials 1-18 cover Japanese-language topics: scripts and reading, radicals, meaning vs. reading, onyomi/kunyomi, rendaku, okurigana, particles, verb groups, politeness, transitivity, counters, plus SRS mechanics (Guru, the stage ladder) and reference entries (JLPT, furigana).

**Reseed caveat:** `body` is seeded on create only and is never overwritten on update, the same treatment as Subject's USER-AUTHORED block. Rewriting a tutorial body does not reach an existing database without a deliberate update path — pass `--force-bodies` to `load-tutorials.ts` for a one-time correction of seed content. See the header comment in `scripts/seed/lib/tutorials.ts`.

### App mechanics (19-21)

Three tutorials cover the app's own rules rather than the language. Each was chosen because it describes behavior that is genuinely counterintuitive from the UI alone:

19. **Mastery vs. SRS stage** (`first_guru`) — the two progressions move independently: stage demotes on a miss, mastery never does. Also covers the mastery-softened Guru+ demotion and why it is measured as a ratio against a clean climb rather than as raw mastery XP.
20. **Skipping kana** (`manual`) — skipping kana does not accelerate kanji, because radicals gate kanji and kana gates radicals. Also covers the type-unlock thresholds.
21. **Lessons, reviews, and practice** (`manual`) — what each of the three modes does and does not move, why unranked practice is deliberately inert, and the 4-hour promotion cap.

Mnemonic editing is covered inside tutorial 21 rather than as its own entry.

**Not written: keyboard shortcuts.** Investigated and dropped — there are no review keyboard shortcuts to document. The only `keydown` handlers in the app are a modal Escape/Tab focus trap, Enter-to-submit in two editors, and an audio warm-up listener. Answer submission works through a native form, so Enter submits and advances; that behavior is documented in tutorial 21. A shortcuts tutorial would need shortcuts to be built first.

## Optional features not built

### Review forecast

**Data layer built, no UI.** `buildForecast` in `src/services/reviews/forecast.ts` buckets scheduled reviews into 4h, 8h, tomorrow, 2 days, week, 2 weeks, month, and later, with overdue items falling into the first bucket. `getReviewForecast` in `src/server/queries/progress.ts` feeds it. Boundaries are half-open `[start, next)`, so an item due at exactly 4h lands in the 4h bucket.

This is strictly "what is already scheduled and when," derived from stored `dueAt` values. The behavioral projection originally sketched here ("if you complete 20 reviews daily, you'll unlock kanji level 3 in 5 days") was deliberately not built: it requires modeling future user behavior rather than reading existing state, which is a different and much less reliable kind of claim.

Remaining: a card on `/progress`. UI/UX design work still needed.

### Offline support

No offline mode or service worker. The app requires network for every lesson and review (they hit the database to lock in state). Offline review queuing (download a batch locally, review, sync on reconnect) is not implemented.

### Review performance stats

**Data layer built, no UI.** `buildReviewStats` in `src/services/reviews/stats.ts` returns accuracy split by question type (always both MEANING and READING, zeroed rather than omitted) and a UTC-daily accuracy trend. `getReviewStats(userId, sinceDays, mode)` in `src/server/queries/progress.ts` feeds it. A log counts as correct when `incorrectCount === 0`.

**Ranked vs. practice:** scoring defaults to ranked only. Unranked practice has no due-date filter, so the same easy items can be drilled all day; folding that into one accuracy number would let volume mask real SRS performance. Practice is identified by `startedStage === endedStage` (`isPracticeLog`), which is the only signal `ReviewLog` carries. Note it slightly over-counts practice: a ranked review whose promotion is blocked by the 4-hour cap also leaves the stage unchanged. `rankedAnswers` and `practiceAnswers` always describe the full fetched set so the UI can show what was excluded.

Remaining: a card or page on `/progress`, and per-item difficulty tracking, which has no stored signal yet and would need a derived metric defined first.

**Both of the above are near-empty until there is review history.** At the time of writing the database holds 208 `UserSubject` rows and very little `ReviewLog` history, so both surfaces render as designed empty states. That is why neither got a UI in the same pass: there is nothing yet to lay out against.

## Known measurements worth instrumenting

### 4-hour promotion cap validation

The 4-hour cap is not validated against real learner behavior. If deployed, instrument these questions:
- Do users actively skip or delay reviews to avoid the cap?
- What is the distribution of promotion intervals (how many correct answers happen within 4 hours of the last promotion)?
- Does lowering or raising the cap change behavior?

See `src/services/srs/transition.ts` for the cap constant and `PROMOTION_COOLDOWN_MS`.

### Question type distribution

Currently, the first question on each subject is random (meaning or reading). Does a fixed order (always meaning first) reduce cognitive load? Do learners have a preference?

See `src/services/reviews/queue.ts` for `questionKindsFor`.

### Demotion formula tuning

`CLEAN_HISTORY_RATIO` (1.6) decides which items get the softened Guru+ penalty. It is an untested guess, picked to sit above a single early miss (~1.5) and below a chronically shaky item (~2.9). Instrument:
- The distribution of `masteryXp / cleanClimbMasteryXp(stage)` at demotion time. What fraction of demotions currently qualify for the soft penalty?
- Whether softening measurably changes how often items return to Guru after a miss.

Known blind spot: the ratio measures accumulated correct volume, not current knowledge, so an item learned months ago and since forgotten receives the softer penalty on the miss that most deserves the harsher one. Weighting recent `ReviewLog` entries would fix this at the cost of a heavier query.

See `demotionPenaltyFactor` in `src/services/srs/transition.ts` and the mastery-softened demotion section in `docs/srs.md`.

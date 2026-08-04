# Roadmap: deliberately unbuilt and gaps

## Deliberately not built

These are design decisions, not oversights.

### Exams

No exam mode or test feature exists. The entire app is built on continuous learning (lessons and spaced-repetition reviews), not on time-bounded exams or checkpoints. The Session table has `EXAM` as an enum value but it is never instantiated.

### Audio

No audio or pronunciation recordings. The app teaches reading (how to parse text, what words mean) and writing (how to input text), not listening or speaking. All examples are written text with furigana alignment.

### Text readings (読解)

Deliberately not built (not an oversight). The `READING` SubjectType exists in the schema with zero rows and is rendered as coming soon. See `docs/text-readings.md` for the investigation: Aozora Bunko (public domain, well-structured ruby) was rejected on content difficulty grounds (Meiji/Taisho-era texts with archaic vocabulary and grammar are not appropriate for learners still in early curriculum levels). When revisited, hand-written graded passages (4-8 sentences each, deliberate vocabulary reuse per level) would be better than automated scraping.

## Content authoring backlog

Real numbers, not approximations. Derived from the schema's content sources and the level-heuristic quota constants.

| Type | Complete | Total seeded | Ladder target | Ladder actual | Unladdered | Status |
|---|---|---|---|---|---|---|
| KANA | 208 | 208 | 208 | 208 | 0 | Done |
| RADICAL | 214 | 214 | ~192 | ~192 | 22 | Done |
| KANJI | 2000+ | 10,384 | ~1980 | ~192 | 10,192 | 79/1980 in ladder (4%) |
| VOCAB | 5400+ | 10,000 | ~5400 | ~5400 | 4,600 | 0/5400 in ladder (0%) |
| SENTENCE | 7705+ | 7,705 | 7,705 | 7,705 | 0 | Done |
| GRAMMAR | 107 | 107 | 107 | 107 | 0 | Done |

The "ladder target" column shows the intended size if fully fleshed out at the quota rates in `scripts/seed/lib/level-heuristic.ts`. The "ladder actual" is what's currently on the ladder (the difference is the authoring gap).

## Tutorial stubs

11 tutorial markdown files are stubbed but not written:

1. How to use the lessons page.
2. How to use the reviews page.
3. Understanding mastery vs. SRS stage.
4. How to edit mnemonics.
5. How to skip ahead (the kana skip flow).
6. Understanding radicals (component gating).
7. Understanding kanji (multiple readings).
8. Understanding vocabulary (composition).
9. Understanding sentences (function-word tolerance).
10. Understanding grammar (patterns and examples).
11. Keyboard shortcuts.

The tutorial system (trigger logic, completion tracking, UI) is fully built. The bodies are there for reference; most just need fuller content. See `scripts/seed/lib/tutorials.ts` and `src/services/tutorials/` for the infrastructure.

## Optional features not built

### Review forecast

The dashboard shows items due today, this week, and "eventually," but does not project forward (e.g., "if you complete 20 reviews daily, you'll unlock kanji level 3 in 5 days"). Forecast is computable from the SRS stage distribution, but UI/UX design work is needed.

### Achievement notifications

Achievements are defined and checked (see `src/services/achievements/definitions.ts`), but there is no notification UI when they're earned. They're visible on the profile page only.

### Offline support

No offline mode or service worker. The app requires network for every lesson and review (they hit the database to lock in state). Offline review queuing (download a batch locally, review, sync on reconnect) is not implemented.

### Review performance stats

No charts, no breakdown of "how many meanings vs. readings I got wrong," no per-item difficulty tracking. Only raw counts (passed, burned) on the profile.

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

The penalty factor (1x for Apprentice, 2x for Guru+) is untested. Is the demotion severity appropriate?

See `src/services/srs/transition.ts` for `demotedStage`.

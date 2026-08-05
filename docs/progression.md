# Progression System

Progression tracks two independent systems: XP (Experience Points), which measures time invested and drives account level, and LP (League Points), which measures current performance on ranked content and drives rank.

## XP and account level

Account level is a pure function of total XP: `accountLevel = levelFromTotalXp(totalXp)`. Nothing else writes `accountLevel`; it is always recomputed from `totalXp` on commit. Level begins at 1 and is unbounded — there is no level cap.

### XP curve

The cost curve is sublinear: `xpForLevel(L) = round(400 + 12 * L^0.85)`. Cost rises as level increases, but at a decaying rate, so growth rate decays smoothly without a hard wall or inflection point. This produces a natural tapering: roughly 1.7 levels per modest day at L1, 0.9 at L50, and 0.25 at L500.

The level cost table is printed by `npm run curve-report`.

`levelFromTotalXp` uses binary search over lazily-extended prefix sums to achieve O(log n) performance in the level, replacing an earlier O(n²) linear walk.

### XP awards

**Lessons (stage 0 to 1):** 25 XP flat. Learning is the highest-value act, so it does not scale with stage.

**Ranked reviews (correct answer):** `8 + 3 * srsStage` XP. Scaled to 10% (floored at 1 XP) if the 4-hour promotion cooldown blocked the stage move.

**Ranked reviews (incorrect answer):** 2 XP (participation reward, flat).

**Unranked practice (correct answer):** 1 XP per correct answer, capped at 150 per day (see below).

**Streak multiplier:** Applied to ranked reviews only. +2% per consecutive day active, capped at 1.5x at 25+ days.

### Practice XP cap

Unranked practice awards 1 XP per correct answer under a hard 150 XP/day cap. The cap exists because `getUnrankedReviewQueue` has no `dueAt` filter — items are re-servable indefinitely. Without the cap, practice XP would be infinitely farmable. The low per-answer rate and absence of a streak multiplier are secondary defenses.

Tracked via `DailyActivity.unrankedXpEarned`, which is separate from `xpEarned` (ranked XP).

## LP and rank

Rank is an independent state driven by LP, not a projection of level. Only ranked reviews and exams move LP. Lessons never do (they have no failure mode). Unranked practice never does (its queue is farmable).

### Tier ladder

Nine tiers in order: IRON, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND, MASTER, GRANDMASTER, CHALLENGER.

The first six tiers are divided into four divisions each (IV to I, IV lowest). MASTER and above have no divisions and share one unbounded LP pool.

### LP model

80% accuracy is the neutral point (`NEUTRAL_ACCURACY = 0.8`). Above 80% you gain LP, below it you lose LP.

Accuracy is measured per **item** — a clean pass, never missed — not per question. An item you got wrong once and then recovered is not a clean pass. This is what "got it right" means to a user.

The swing scales with session size via a sqrt coefficient, so a 3-item session cannot meaningfully move rank while a 40-item session is not undervalued. K is clamped to 5-30 LP: `K = min(30, max(5, round(4 * sqrt(itemsTotal))))`. Exams swing 1.5x harder than reviews.

Formula: `delta = round((K * (accuracy - 0.8)) / 0.2)`

Sessions with fewer than 3 items award 0 LP.

Losses are dampened at 75%, so a bad session stings without erasing two good ones.

#### Over-achievement multipliers

S-rank (95%+ accuracy, 15+ items) multiplies delta by 3. Perfect (100% accuracy, 25+ items) multiplies delta by 5. These bonuses apply only to positive deltas and are what make double promotion reachable: base K at 30 items is 30 LP, and `30 * 5 = 150`, which crosses two 100-LP division boundaries from a high start.

### Promotion and demotion

Crossing 100 LP promotes and carries the remainder, so a large gain genuinely crosses two boundaries. Landing exactly at or above 100 promotes to the next division; at division I, promotes to the next tier.

Falling below 0 LP demotes and lands at 75 LP (not 99) so a single good session does not immediately bounce you back.

**Crucially: tiers are never lost.** At division IV of any tier, LP floors at 0 instead of demoting out. This is a high-water mark suitable for a solo learning app — a bad week should not erase months of progress. Master and above are unbounded pools with no demotion risk.

### Rank milestones (apex tiers)

Once promoted to Master, you enter the apex tier pool where LP is unbounded and demotion is impossible. Within the pool: Master tier occupies LP 0-499, Grandmaster tier LP 500-999, Challenger tier LP 1000+. LP floors at 0 once in the pool, so a Grandmaster with 600 LP who loses 150 LP drops to Master without losing the tier itself.

## LP and XP independence

The split is deliberate and complete. A user can be a high level (invested much time) with a low rank (performing poorly now), or the reverse (accurate, but new to the app).

There is no interaction between them at all. `accountLevel` is a pure function of `totalXp`; `lp` and `rank` are written only by ranked review commits. Content unlocking is gated on **curriculum level** (see below), which is a third, separately derived value — not on account level and not on rank.

Before this split, `rankForLevel(level)` projected XP onto a tier, so rank could only ever rise and said nothing about how well you were answering. That function no longer exists.

## Curriculum levels

Each subject type (KANA, RADICAL, KANJI, VOCAB, SENTENCE, GRAMMAR) tracks an independent progression level. A type's level advances when 90% of that type's subjects at the current level reach Guru (stage 5+).

Curriculum levels are derived, never stored, and queried via `getCurriculumLevels`. They are used for unlock gating: a subject at curriculum level 7 is unlocked only when the user's current level for that type is at least 7.

## Schema additions

**UserProfile:**
- `lp` (Int, default 0): current LP within the division or apex pool.
- `rank` (String, default "IRON"): current tier name.
- `rankDivision` (Int?, default 4): division within the tier (4 lowest, 1 highest). Null for Master+.
- `peakRank` (String, default "IRON"): high-water mark tier name, never decreases.
- `peakRankDivision` (Int?, default 4): high-water mark division, preserved for display.

**DailyActivity:**
- `unrankedXpEarned` (Int, default 0): portion of `xpEarned` from unranked practice, tracked separately for cap enforcement.

**UserAchievement (new table):**
- `userId` and `achievementId` (composite primary key): records when an achievement was first earned.
- `earnedAt` (DateTime, default now): timestamp of earn time.

**LpEvent (new table):**
- `id` (String, primary key): unique event id.
- `userId` (String): user who experienced the change.
- `delta` (Int): LP gained (positive) or lost (negative).
- `reason` (String): "review" or "exam".
- `sessionId` (String?): session that produced the change.
- `accuracy` (Float): session accuracy, kept so the formula can be re-derived against history.
- `itemCount` (Int): session size.
- `tierAfter` (String), `divisionAfter` (Int?), `lpAfter` (Int): ladder position after applying delta, for auditability.
- `createdAt` (DateTime, default now): when the change occurred.

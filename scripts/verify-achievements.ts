// Verifies achievement persistence and "newly earned" detection against a
// THROWAWAY user. Never touches local-user.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { recordNewAchievements, backfillEarnedAchievements } from "../src/server/queries/newAchievements";
import { getAchievements } from "../src/server/queries/achievements";

const TEST_USER = "achievement-check-user";
const REAL_USER = "local-user";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.userAchievement.deleteMany({ where: { userId: TEST_USER } });
  await prisma.reviewLog.deleteMany({ where: { userSubject: { userId: TEST_USER } } });
  await prisma.xpEvent.deleteMany({ where: { userId: TEST_USER } });
  await prisma.lpEvent.deleteMany({ where: { userId: TEST_USER } });
  await prisma.dailyActivity.deleteMany({ where: { userId: TEST_USER } });
  await prisma.session.deleteMany({ where: { userId: TEST_USER } });
  await prisma.userSubject.deleteMany({ where: { userId: TEST_USER } });
  await prisma.userProfile.deleteMany({ where: { userId: TEST_USER } });
}

(async () => {
  const realBefore = await prisma.userProfile.findUnique({ where: { userId: REAL_USER } });
  const realAchievementsBefore = await prisma.userAchievement.count({ where: { userId: REAL_USER } });

  try {
    await cleanup();
    await prisma.userProfile.create({
      data: { userId: TEST_USER, displayName: "Achievement Test", timezone: "Asia/Tokyo" },
    });

    // A fresh account qualifies for nothing.
    const none = await recordNewAchievements(TEST_USER);
    check("a fresh account earns nothing", none.length === 0, `got ${none.length}`);

    // Earn "first-item" and "first-lesson" by passing a subject and logging
    // a lesson session.
    const subjects = await prisma.subject.findMany({
      where: { type: "RADICAL" },
      take: 12,
      select: { id: true },
    });
    const now = new Date();
    for (const s of subjects) {
      await prisma.userSubject.create({
        data: {
          userId: TEST_USER,
          subjectId: s.id,
          unlockedAt: now,
          startedAt: now,
          passedAt: now,
          srsStage: 5,
        },
      });
    }
    await prisma.session.create({
      data: {
        userId: TEST_USER,
        kind: "LESSON",
        startedAt: now,
        completedAt: now,
        totalItems: 12,
        correctItems: 12,
        scorePct: 100,
        xpAwarded: 300,
      },
    });

    const earned = await recordNewAchievements(TEST_USER);
    const ids = earned.map((a) => a.id);
    check("newly-earned achievements are reported", earned.length > 0, ids.join(", "));
    check("includes the first-item milestone", ids.includes("first-item"));
    check("includes the new first-lesson milestone", ids.includes("first-lesson"));
    check("includes the new items-10 milestone", ids.includes("items-10"));
    check("includes radicals-10-guru (the kanji unlock signpost)", ids.includes("radicals-10-guru"));

    // Second call must report nothing: they are already recorded.
    const again = await recordNewAchievements(TEST_USER);
    check("already-earned achievements are not re-reported", again.length === 0, `got ${again.length}`);

    const stored = await prisma.userAchievement.count({ where: { userId: TEST_USER } });
    check("earned achievements are persisted", stored === earned.length, `stored ${stored}`);

    // Backfill must be idempotent and silent.
    const backfilled = await backfillEarnedAchievements(TEST_USER);
    check("backfill adds nothing when already recorded", backfilled === 0, `added ${backfilled}`);

    // The roster still evaluates cleanly.
    const { unlocked, locked } = await getAchievements(TEST_USER);
    check("roster splits into unlocked/locked", unlocked.length > 0 && locked.length > 0, `${unlocked.length}/${locked.length}`);
  } catch (e) {
    console.log("ERR: " + (e as Error).message);
    failures++;
  } finally {
    await cleanup();
    const realAfter = await prisma.userProfile.findUnique({ where: { userId: REAL_USER } });
    const realAchievementsAfter = await prisma.userAchievement.count({ where: { userId: REAL_USER } });
    const ser = (p: unknown) => JSON.stringify(p, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    check(
      "local-user untouched",
      ser(realBefore) === ser(realAfter) && realAchievementsBefore === realAchievementsAfter,
    );
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();

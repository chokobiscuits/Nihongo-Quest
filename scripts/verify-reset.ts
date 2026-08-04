// Verifies resetProgress against a THROWAWAY user id. Never touches
// local-user. Creates a profile with some progress, resets it, asserts
// everything is gone and the profile is back to defaults, then cleans up.
import { prisma } from "../src/lib/db";
import { resetProgress, RESET_CONFIRMATION } from "../src/server/actions/reset";

const TEST_USER = "reset-check-user";

async function cleanup() {
  await prisma.reviewLog.deleteMany({ where: { userSubject: { userId: TEST_USER } } });
  await prisma.userSubject.deleteMany({ where: { userId: TEST_USER } });
  await prisma.xpEvent.deleteMany({ where: { userId: TEST_USER } });
  await prisma.session.deleteMany({ where: { userId: TEST_USER } });
  await prisma.dailyActivity.deleteMany({ where: { userId: TEST_USER } });
  await prisma.tutorialCompletion.deleteMany({ where: { userId: TEST_USER } });
  await prisma.userProfile.deleteMany({ where: { userId: TEST_USER } });
}

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

(async () => {
  try {
    await cleanup();

    // Snapshot real user first, to prove we never touch it.
    const before = await prisma.userProfile.findUnique({ where: { userId: "local-user" } });
    const beforeSubjects = await prisma.userSubject.count({ where: { userId: "local-user" } });

    await prisma.userProfile.create({
      data: {
        userId: TEST_USER,
        displayName: "Reset Test",
        totalXp: BigInt(5000),
        accountLevel: 12,
        rank: "SILVER",
        rankDivision: 2,
        currentStreak: 7,
        longestStreak: 9,
        lastActiveDay: new Date(),
        timezone: "Asia/Tokyo",
      },
    });

    const subject = await prisma.subject.findFirst({ select: { id: true } });
    if (!subject) throw new Error("no seeded subjects");

    const us = await prisma.userSubject.create({
      data: { userId: TEST_USER, subjectId: subject.id, startedAt: new Date(), srsStage: 4, masteryXp: 100 },
    });
    const sess = await prisma.session.create({
      data: { userId: TEST_USER, kind: "REVIEW", startedAt: new Date(), totalItems: 1, correctItems: 1, scorePct: 100, xpAwarded: 10 },
    });
    await prisma.reviewLog.create({
      data: { userSubjectId: us.id, sessionId: sess.id, questionType: "MEANING", incorrectCount: 0, startedStage: 3, endedStage: 4 },
    });
    await prisma.xpEvent.create({ data: { userId: TEST_USER, amount: 10, reason: "review", sessionId: sess.id } });
    await prisma.dailyActivity.create({ data: { userId: TEST_USER, day: new Date(), reviewCount: 1, xpEarned: 10 } });

    // Wrong confirmation must refuse.
    let refused = false;
    try {
      await resetProgress("nope", TEST_USER);
    } catch {
      refused = true;
    }
    check("refuses without the confirmation word", refused);
    check("nothing deleted on refusal", (await prisma.userSubject.count({ where: { userId: TEST_USER } })) === 1);

    const result = await resetProgress(RESET_CONFIRMATION, TEST_USER);
    check("reports deleted counts", result.userSubjects === 1 && result.reviewLogs === 1, JSON.stringify(result));

    check("userSubjects gone", (await prisma.userSubject.count({ where: { userId: TEST_USER } })) === 0);
    check("reviewLogs gone", (await prisma.reviewLog.count({ where: { userSubject: { userId: TEST_USER } } })) === 0);
    check("sessions gone", (await prisma.session.count({ where: { userId: TEST_USER } })) === 0);
    check("xpEvents gone", (await prisma.xpEvent.count({ where: { userId: TEST_USER } })) === 0);
    check("dailyActivity gone", (await prisma.dailyActivity.count({ where: { userId: TEST_USER } })) === 0);

    const after = await prisma.userProfile.findUniqueOrThrow({ where: { userId: TEST_USER } });
    check("totalXp reset", after.totalXp === BigInt(0), String(after.totalXp));
    check("level reset", after.accountLevel === 1, String(after.accountLevel));
    check("rank reset", after.rank === "IRON", after.rank);
    check("streaks reset", after.currentStreak === 0 && after.longestStreak === 0);
    check("lastActiveDay cleared", after.lastActiveDay === null);
    check("displayName preserved", after.displayName === "Reset Test", after.displayName);
    check("timezone preserved", after.timezone === "Asia/Tokyo", after.timezone);

    const seeded = await prisma.subject.count();
    check("seeded content untouched", seeded > 0, `${seeded} subjects`);

    const afterReal = await prisma.userProfile.findUnique({ where: { userId: "local-user" } });
    const afterRealSubjects = await prisma.userSubject.count({ where: { userId: "local-user" } });
    const ser = (p: typeof before) => (p ? JSON.stringify(p, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) : "null");
    check(
      "real user untouched",
      ser(before) === ser(afterReal) && beforeSubjects === afterRealSubjects,
      `${beforeSubjects} -> ${afterRealSubjects} subjects`,
    );

    await cleanup();
    check("test user cleaned up", (await prisma.userProfile.count({ where: { userId: TEST_USER } })) === 0);

    console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  } catch (e) {
    console.log("ERR: " + (e as Error).message);
    await cleanup();
  } finally {
    await prisma.$disconnect();
  }
})();

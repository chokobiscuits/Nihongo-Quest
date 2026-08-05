// Verifies the unranked practice XP daily cap end to end against a
// THROWAWAY user. Never touches local-user.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { commitUnrankedReviewSession, type ReviewAnswerRecord } from "../src/server/actions/reviews";
import { UNRANKED_DAILY_XP_CAP } from "../src/services/xp/curve";

const TEST_USER = "practice-cap-user";
const REAL_USER = "local-user";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
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
  const realSubjectsBefore = await prisma.userSubject.count({ where: { userId: REAL_USER } });

  try {
    await cleanup();
    await prisma.userProfile.create({
      data: { userId: TEST_USER, displayName: "Practice Cap Test", timezone: "Asia/Tokyo" },
    });

    // Seed 60 started items so a single session can exceed the cap.
    const subjects = await prisma.subject.findMany({ take: 60, select: { id: true } });
    const now = new Date();
    for (const s of subjects) {
      await prisma.userSubject.create({
        data: { userId: TEST_USER, subjectId: s.id, unlockedAt: now, startedAt: now, srsStage: 3 },
      });
    }
    const rows = await prisma.userSubject.findMany({ where: { userId: TEST_USER }, select: { id: true } });

    const answersFor = (n: number): ReviewAnswerRecord[] =>
      rows.slice(0, n).map((r) => ({
        userSubjectId: r.id,
        questionType: "MEANING" as const,
        correct: true,
        incorrectCount: 0,
      }));

    // First session: 60 correct answers, well under the 150 cap.
    const first = await commitUnrankedReviewSession({ answers: answersFor(60) }, TEST_USER);
    check("first session awards flat XP", first.xpAwarded === 60, `awarded ${first.xpAwarded}`);
    check("first session is not capped", first.xpCapped === false);

    // Second and third push past the cap.
    await commitUnrankedReviewSession({ answers: answersFor(60) }, TEST_USER);
    const third = await commitUnrankedReviewSession({ answers: answersFor(60) }, TEST_USER);
    check("third session is capped", third.xpCapped === true, `awarded ${third.xpAwarded}`);

    const activity = await prisma.dailyActivity.findFirst({ where: { userId: TEST_USER } });
    check(
      "total practice XP never exceeds the daily cap",
      (activity?.unrankedXpEarned ?? 0) <= UNRANKED_DAILY_XP_CAP,
      `earned ${activity?.unrankedXpEarned} vs cap ${UNRANKED_DAILY_XP_CAP}`,
    );

    // A fourth session once the cap is spent must award nothing.
    const fourth = await commitUnrankedReviewSession({ answers: answersFor(60) }, TEST_USER);
    check("a session past the cap awards zero", fourth.xpAwarded === 0);
    check("remaining is reported as zero", fourth.practiceXpRemaining === 0);

    // Practice must not have touched SRS state, mastery or rank.
    const sample = await prisma.userSubject.findFirstOrThrow({ where: { userId: TEST_USER } });
    check("practice leaves srsStage untouched", sample.srsStage === 3, `stage ${sample.srsStage}`);
    check("practice awards no mastery", sample.masteryXp === 0, `masteryXp ${sample.masteryXp}`);
    const prof = await prisma.userProfile.findUniqueOrThrow({ where: { userId: TEST_USER } });
    check("practice awards no LP", prof.lp === 0, `lp ${prof.lp}`);
    check("practice leaves rank at Iron", prof.rank === "IRON", prof.rank);
    check("practice does award XP", Number(prof.totalXp) === UNRANKED_DAILY_XP_CAP, `totalXp ${prof.totalXp}`);
  } catch (e) {
    console.log("ERR: " + (e as Error).message);
    failures++;
  } finally {
    await cleanup();
    const realAfter = await prisma.userProfile.findUnique({ where: { userId: REAL_USER } });
    const realSubjectsAfter = await prisma.userSubject.count({ where: { userId: REAL_USER } });
    const ser = (p: unknown) => JSON.stringify(p, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    check(
      "local-user untouched",
      ser(realBefore) === ser(realAfter) && realSubjectsBefore === realSubjectsAfter,
    );
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();

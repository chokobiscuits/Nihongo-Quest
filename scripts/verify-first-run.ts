// Verifies getFirstRunTutorial against a THROWAWAY user id. Never touches
// local-user. Asserts the dashboard redirect fires for an account with no
// tutorial completions and stops firing the moment one is acknowledged —
// the property that keeps "/" from becoming permanently unreachable.
import { prisma } from "../src/lib/db";
import { getFirstRunTutorial, getNextRequiredTutorial } from "../src/server/queries/tutorials";

const TEST_USER = "first-run-check-user";

async function cleanup() {
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

    // Prove we never touch the real user.
    const realBefore = await prisma.tutorialCompletion.count({ where: { userId: "local-user" } });

    const tutorialCount = await prisma.tutorial.count({ where: { required: true } });
    if (tutorialCount === 0) {
      console.log("SKIP: no required tutorials seeded — run `npm run seed:load-tutorials` first.");
      await cleanup();
      process.exit(0);
    }

    // getFirstRunTutorial creates the profile on demand via computeTutorialStats.
    const fresh = await getFirstRunTutorial(TEST_USER);
    check("fresh account gets a first-run tutorial", fresh !== null, fresh?.slug ?? "null");
    check("the first-run tutorial is required", fresh?.required === true);

    // It must be the lowest-order triggered one, matching the lesson gate.
    const viaGate = await getNextRequiredTutorial(TEST_USER);
    check(
      "agrees with the lesson gate on a fresh account",
      fresh?.id === viaGate?.id,
      `${fresh?.slug} vs ${viaGate?.slug}`,
    );

    // Acknowledging anything must end the redirect. This is the property the
    // whole design rests on: without it, "/" bounces forever.
    if (fresh) {
      await prisma.tutorialCompletion.create({
        data: { userId: TEST_USER, tutorialId: fresh.id, acknowledged: true },
      });
    }

    const afterAck = await getFirstRunTutorial(TEST_USER);
    check("returns null once any tutorial is acknowledged", afterAck === null, afterAck?.slug ?? "null");

    // ...even though the broader lesson-gate query may still have pending
    // items. That divergence is exactly why the narrow query exists.
    const gateAfter = await getNextRequiredTutorial(TEST_USER);
    console.log(
      `      (lesson gate still pending: ${gateAfter ? gateAfter.slug : "none"} — ` +
        `redirecting on that would trap the dashboard)`,
    );

    // Deleting completions (what resetProgress does) must restore first-run.
    await prisma.tutorialCompletion.deleteMany({ where: { userId: TEST_USER } });
    const afterReset = await getFirstRunTutorial(TEST_USER);
    check("a reset account is treated as first-run again", afterReset !== null, afterReset?.slug ?? "null");

    const realAfter = await prisma.tutorialCompletion.count({ where: { userId: "local-user" } });
    check("real user untouched", realBefore === realAfter, `${realBefore} -> ${realAfter}`);

    await cleanup();
    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);
  } catch (error) {
    console.error("Verification threw:", error);
    await cleanup().catch(() => {});
    process.exit(1);
  }
})();

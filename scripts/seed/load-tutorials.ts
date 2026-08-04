// Loads the hand-encoded TUTORIALS constant (scripts/seed/lib/tutorials.ts)
// into the Tutorial table. Idempotent, upserts on slug, re-runnable safely.
// `body` is treated like Subject's USER-AUTHORED fields: seeded on create,
// never overwritten on update, so a user's own edits to a tutorial's body
// survive a reseed. Every other field (order, titles, trigger, required,
// estimatedMinutes) is seed-owned and always kept in sync on update.
//
// Pass --force-bodies to overwrite existing bodies on update too. This is
// NOT the default because it would silently clobber any user's own edits to
// a tutorial body. Only use it for a one-time correction of seed content
// before any user has had a chance to edit a tutorial (there is currently no
// UI for editing tutorial bodies, so this is safe today, but the flag must
// stay opt-in so it doesn't become an accidental default later).
import "dotenv/config";
import { prisma } from "../../src/lib/db";
import type { Prisma } from "../../src/generated/prisma/client";
import { TUTORIALS } from "./lib/tutorials";

function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

async function main() {
  const forceBodies = process.argv.includes("--force-bodies");
  let created = 0;
  let updated = 0;

  for (const t of TUTORIALS) {
    const existing = await prisma.tutorial.findUnique({ where: { slug: t.slug }, select: { id: true } });

    await prisma.tutorial.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        order: t.order,
        titleEn: t.titleEn,
        titleJa: t.titleJa,
        body: t.body,
        trigger: toJsonInput(t.trigger),
        required: t.required,
        estimatedMinutes: t.estimatedMinutes,
      },
      update: {
        order: t.order,
        titleEn: t.titleEn,
        titleJa: t.titleJa,
        trigger: toJsonInput(t.trigger),
        required: t.required,
        estimatedMinutes: t.estimatedMinutes,
        // body intentionally omitted by default — never overwrite a
        // user-edited body. --force-bodies opts into overwriting it.
        ...(forceBodies ? { body: t.body } : {}),
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(
    `[tutorials] upserted ${TUTORIALS.length} (${created} created, ${updated} updated)${forceBodies ? " [bodies forced]" : ""}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

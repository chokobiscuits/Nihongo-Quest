// Loads the hand-encoded TUTORIALS constant (scripts/seed/lib/tutorials.ts)
// into the Tutorial table. Idempotent, upserts on slug — re-runnable safely.
// `body` is treated like Subject's USER-AUTHORED fields: seeded on create,
// never overwritten on update, so a user's own edits to a tutorial's body
// survive a reseed. Every other field (order, titles, trigger, required,
// estimatedMinutes) is seed-owned and always kept in sync on update.
import "dotenv/config";
import { prisma } from "../../src/lib/db";
import type { Prisma } from "../../src/generated/prisma/client";
import { TUTORIALS } from "./lib/tutorials";

function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

async function main() {
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
        // body intentionally omitted — never overwrite a user-edited body.
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`[tutorials] upserted ${TUTORIALS.length} (${created} created, ${updated} updated)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

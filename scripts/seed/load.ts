// Phase 3: thin load. Reads data/processed/*.jsonl (already produced by
// transform.ts) and upserts into Postgres via Prisma. No parsing decisions
// live here — this file only resolves tempId -> real Subject.id and calls
// prisma upserts, batched, idempotent, safe to re-run.
//
// Idempotency: Subject.slug is @unique, so subjects upsert on slug.
// SubjectComponent's compound id (parentId, childId) makes component edges
// naturally idempotent once tempIds are resolved to real ids. DataSource
// rows upsert on name (there is no unique constraint on name in the schema,
// so we delete-then-recreate the seeded set instead — safe because
// DataSource carries no user data and no other table references it by id
// that would survive a delete+recreate. See findAndReplaceDataSources below.)
// dotenv must be imported before src/lib/db, which reads DATABASE_URL at
// module scope. prisma.config.ts loads dotenv for Prisma CLI commands only;
// this script runs under tsx and gets no env loading for free.
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../../src/lib/db";
import type { Prisma } from "../../src/generated/prisma/client";
import type { ComponentRecord, DataSourceRecord, SubjectRecord } from "./lib/types";

/// Our JSONL artifacts are already plain JSON-safe values; this cast just
/// satisfies Prisma's InputJsonValue type, which has no direct overlap with
/// our own narrower TS interfaces (MeaningEntry[], FuriganaSegment[], ...).
function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

const OUT_DIR = path.resolve(__dirname, "../../data/processed");
const BATCH_SIZE = 500;

function readJsonl<T>(filename: string): T[] {
  const text = readFileSync(path.join(OUT_DIR, filename), "utf-8");
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function upsertSubjects(subjects: SubjectRecord[]): Promise<Map<string, string>> {
  const tempIdToRealId = new Map<string, string>();

  for (const batch of chunk(subjects, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((s) =>
        prisma.subject.upsert({
          where: { slug: s.slug },
          create: {
            type: s.type,
            level: s.level,
            slug: s.slug,
            characters: s.characters,
            meanings: toJsonInput(s.meanings),
            readings: toJsonInput(s.readings),
            jlpt: s.jlpt,
            jlptLegacy: s.jlptLegacy,
            frequency: s.frequency,
            metadata: toJsonInput(s.metadata),
            furigana: s.furigana ? toJsonInput(s.furigana) : undefined,
            furiganaFallback: s.furiganaFallback,
          },
          // Only seeded fields are updated on re-run. USER-AUTHORED fields
          // (meaningMnemonic, readingMnemonic, hints, acceptedMeanings,
          // authored) are never touched here, matching the schema's own
          // separation between seeded and user content.
          update: {
            type: s.type,
            level: s.level,
            characters: s.characters,
            meanings: toJsonInput(s.meanings),
            readings: toJsonInput(s.readings),
            jlpt: s.jlpt,
            jlptLegacy: s.jlptLegacy,
            frequency: s.frequency,
            metadata: toJsonInput(s.metadata),
            furigana: s.furigana ? toJsonInput(s.furigana) : undefined,
            furiganaFallback: s.furiganaFallback,
          },
        }),
      ),
    );
    console.log(`[subjects] upserted ${batch.length} (running total in this run: n/a, batched)`);
  }

  // Resolve tempId -> real id in a second pass, since upsert results above
  // aren't guaranteed ordered against the input batch in every Prisma
  // version; a plain findMany by slug is simpler and just as fast at this
  // volume (tens of thousands of rows, one query).
  const bySlug = new Map(subjects.map((s) => [s.slug, s.tempId]));
  const rows = await prisma.subject.findMany({ select: { id: true, slug: true } });
  for (const row of rows) {
    const tempId = bySlug.get(row.slug);
    if (tempId) tempIdToRealId.set(tempId, row.id);
  }

  return tempIdToRealId;
}

async function upsertComponents(components: ComponentRecord[], tempIdToRealId: Map<string, string>) {
  let skipped = 0;
  const resolved = components
    .map((c) => {
      const parentId = tempIdToRealId.get(c.parentTempId);
      const childId = tempIdToRealId.get(c.childTempId);
      if (!parentId || !childId) {
        skipped += 1;
        return null;
      }
      return {
        parentId,
        childId,
        position: c.position,
        isRadical: c.isRadical,
        readingUsed: c.readingUsed,
        isGating: c.isGating,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  for (const batch of chunk(resolved, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((c) =>
        prisma.subjectComponent.upsert({
          where: { parentId_childId: { parentId: c.parentId, childId: c.childId } },
          create: c,
          update: {
            position: c.position,
            isRadical: c.isRadical,
            readingUsed: c.readingUsed,
            isGating: c.isGating,
          },
        }),
      ),
    );
  }

  console.log(`[components] upserted ${resolved.length}, skipped ${skipped} (unresolved tempId, likely a filtered-out subject)`);
}

async function replaceDataSources(sources: DataSourceRecord[]) {
  // DataSource has no unique key besides its cuid `id`, so re-running the
  // load safely replaces the whole seeded set rather than upserting rows
  // that have no natural key to upsert on. This table has no incoming
  // foreign keys, so a delete+recreate cannot orphan anything.
  await prisma.$transaction([
    prisma.dataSource.deleteMany({}),
    prisma.dataSource.createMany({
      data: sources.map((s) => ({
        name: s.name,
        url: s.url,
        license: s.license,
        versionDate: new Date(s.versionDate),
        attribution: s.attribution,
      })),
    }),
  ]);
  console.log(`[data-sources] replaced with ${sources.length} rows`);
}

async function main() {
  const subjects = readJsonl<SubjectRecord>("subjects.jsonl");
  const components = readJsonl<ComponentRecord>("components.jsonl");
  const dataSources = readJsonl<DataSourceRecord>("data-sources.jsonl");

  console.log(`Loading ${subjects.length} subjects, ${components.length} components, ${dataSources.length} data sources...`);

  const tempIdToRealId = await upsertSubjects(subjects);
  await upsertComponents(components, tempIdToRealId);
  await replaceDataSources(dataSources);

  console.log("\nLoad complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

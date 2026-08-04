// Per-type curriculum level and type-unlock inputs, computed with grouped
// aggregates (no per-level or per-type round trips). Feeds the pure
// functions in src/services/srs/curriculum.ts and
// src/services/srs/typeUnlock.ts.

import { prisma } from "@/lib/db";
import { SubjectType } from "@/generated/prisma/enums";
import { GURU_STAGE } from "@/services/srs/stages";
import { curriculumLevel, type LevelGuruStats } from "@/services/srs/curriculum";
import { typeUnlockStatuses, type GuruCounts, type TypeUnlockStatus } from "@/services/srs/typeUnlock";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

const LADDER_TYPES: SubjectType[] = [
  SubjectType.KANA,
  SubjectType.RADICAL,
  SubjectType.KANJI,
  SubjectType.VOCAB,
  SubjectType.SENTENCE,
  SubjectType.GRAMMAR,
];

/// Curriculum level for every laddered type, in one pass: a single grouped
/// count of laddered subjects per (type, level), and a single grouped count
/// of this user's Guru+ subjects per (type, level), joined in memory.
export async function getCurriculumLevels(userId: string = APP_USER_ID): Promise<Record<SubjectType, number>> {
  const [totals, guruRows] = await Promise.all([
    prisma.subject.groupBy({
      by: ["type", "level"],
      where: { type: { in: LADDER_TYPES }, level: { not: null } },
      _count: true,
    }),
    // Join through userSubject -> subject to bucket this user's Guru+ rows
    // by (type, level) without an N+1: group by subjectId first is not
    // possible directly on a joined field in Prisma, so this groups on the
    // relation's scalar via a raw-free approach — fetch minimal rows and
    // bucket in memory. Guru+ rows per user are bounded by total laddered
    // content, never re-queried per type/level.
    prisma.userSubject.findMany({
      where: { userId, srsStage: { gte: GURU_STAGE }, subject: { type: { in: LADDER_TYPES }, level: { not: null } } },
      select: { subject: { select: { type: true, level: true } } },
    }),
  ]);

  const totalByTypeLevel = new Map<string, number>();
  for (const row of totals) {
    if (row.level === null) continue;
    totalByTypeLevel.set(`${row.type}:${row.level}`, row._count);
  }

  const guruByTypeLevel = new Map<string, number>();
  for (const row of guruRows) {
    const { type, level } = row.subject;
    if (level === null) continue;
    const key = `${type}:${level}`;
    guruByTypeLevel.set(key, (guruByTypeLevel.get(key) ?? 0) + 1);
  }

  const result = {} as Record<SubjectType, number>;
  for (const type of LADDER_TYPES) {
    const levels = new Set<number>();
    for (const key of totalByTypeLevel.keys()) {
      const [t, l] = key.split(":");
      if (t === type) levels.add(Number(l));
    }
    const stats: LevelGuruStats[] = Array.from(levels)
      .sort((a, b) => a - b)
      .map((level) => ({
        level,
        total: totalByTypeLevel.get(`${type}:${level}`) ?? 0,
        guruCount: guruByTypeLevel.get(`${type}:${level}`) ?? 0,
      }));
    result[type] = curriculumLevel(stats);
  }
  // READING has no ladder — level is meaningless but keep the record total.
  result[SubjectType.READING] = 1;

  return result;
}

/// Guru counts per gating type (RADICAL/KANJI/VOCAB/GRAMMAR), for
/// typeUnlockStatuses. One grouped-by-subjectId-free query: count Guru+
/// UserSubject rows joined to their subject type directly.
export async function getGuruCounts(userId: string = APP_USER_ID): Promise<GuruCounts> {
  const rows = await prisma.userSubject.findMany({
    where: {
      userId,
      srsStage: { gte: GURU_STAGE },
      subject: { type: { in: [SubjectType.RADICAL, SubjectType.KANJI, SubjectType.VOCAB, SubjectType.GRAMMAR] } },
    },
    select: { subject: { select: { type: true } } },
  });

  const counts: GuruCounts = { RADICAL: 0, KANJI: 0, VOCAB: 0, GRAMMAR: 0 };
  for (const row of rows) {
    const t = row.subject.type;
    if (t === SubjectType.RADICAL) counts.RADICAL++;
    else if (t === SubjectType.KANJI) counts.KANJI++;
    else if (t === SubjectType.VOCAB) counts.VOCAB++;
    else if (t === SubjectType.GRAMMAR) counts.GRAMMAR++;
  }
  return counts;
}

/// Convenience wrapper: type-unlock status for every gated type, for this
/// user, in one call.
export async function getTypeUnlockStatuses(
  userId: string = APP_USER_ID,
): Promise<Record<"KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR" | "READING", TypeUnlockStatus>> {
  const guru = await getGuruCounts(userId);
  return typeUnlockStatuses(guru);
}

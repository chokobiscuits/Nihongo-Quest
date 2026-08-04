// Batch-generates meaning/reading mnemonics for Subject rows that don't have
// one yet, via an LLM. Runnable as `npm run mnemonics:generate -- [flags]`.
//
// Writes ONLY to Subject's USER-AUTHORED mnemonic fields
// (meaningMnemonic, readingMnemonic, mnemonicSource) — see the block comment
// on that model in prisma/schema.prisma. Never touches UserSubject,
// Session, XpEvent, DailyActivity, TutorialCompletion, or any other table.
//
// Resumability: selects on `mnemonicSource IS NULL` (see selectSubjects
// below), so interrupting and re-running with the same flags picks up where
// it left off without --regenerate ever being needed for that. --regenerate
// is only for deliberately redoing rows already marked "generated"; rows
// marked "authored" (hand-edited by the user via the mnemonic editor — see
// src/server/actions/mnemonics.ts) are never selected, with or without
// --regenerate.
import "dotenv/config";
import { prisma } from "../../src/lib/db";
import { SubjectType } from "../../src/generated/prisma/enums";
import { createClient, type MnemonicClient } from "./client";
import {
  buildRadicalPrompt,
  parseRadicalResponse,
  buildKanjiPrompt,
  parseKanjiResponse,
  buildVocabPrompt,
  parseVocabResponse,
  buildGrammarPrompt,
  parseGrammarResponse,
  buildKanaPrompt,
  parseKanaResponse,
  type MeaningEntry,
  type ReadingEntry,
} from "./prompts";

// ------------------------------------------------------------------- flags

interface Flags {
  type?: SubjectType;
  level?: number;
  limit?: number;
  dryRun: boolean;
  regenerate: boolean;
  yes: boolean;
  mock: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, regenerate: false, yes: false, mock: false };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--regenerate") flags.regenerate = true;
    else if (arg === "--yes") flags.yes = true;
    else if (arg === "--mock") flags.mock = true;
    else if (arg.startsWith("--type=")) {
      const value = arg.slice("--type=".length).toUpperCase();
      const validTypes: string[] = [SubjectType.KANJI, SubjectType.RADICAL, SubjectType.VOCAB, SubjectType.GRAMMAR, SubjectType.KANA];
      if (!validTypes.includes(value)) {
        throw new Error(`--type must be one of ${validTypes.join(", ")}, got "${value}"`);
      }
      flags.type = value as SubjectType;
    } else if (arg.startsWith("--level=")) {
      const value = Number(arg.slice("--level=".length));
      if (!Number.isInteger(value) || value < 1 || value > 60) {
        throw new Error(`--level must be an integer between 1 and 60, got "${arg}"`);
      }
      flags.level = value;
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit must be a positive integer, got "${arg}"`);
      }
      flags.limit = value;
    } else {
      throw new Error(`Unrecognized flag: ${arg}`);
    }
  }
  return flags;
}

// -------------------------------------------------------------- selection

interface SubjectRow {
  id: string;
  type: SubjectType;
  characters: string | null;
  meanings: unknown;
  readings: unknown;
  metadata: unknown;
}

async function selectSubjects(flags: Flags): Promise<SubjectRow[]> {
  const where: Record<string, unknown> = {
    mnemonicSource: flags.regenerate ? "generated" : null,
  };
  if (flags.type) where.type = flags.type;
  if (flags.level !== undefined) where.level = flags.level;

  return prisma.subject.findMany({
    where,
    orderBy: [{ level: "asc" }, { slug: "asc" }],
    take: flags.limit,
    select: { id: true, type: true, characters: true, meanings: true, readings: true, metadata: true },
  });
}

// --------------------------------------------------------- component lookup

interface ComponentInfo {
  name: string;
  characters: string | null;
  meanings: MeaningEntry[];
  readings: ReadingEntry[];
}

/// Fetches each subject's gating radical/kanji components (SubjectComponent
/// where the given subject is the parent), keyed by subject id. One query
/// for the whole batch rather than N+1.
async function fetchComponents(subjectIds: string[]): Promise<Map<string, ComponentInfo[]>> {
  if (subjectIds.length === 0) return new Map();

  const edges = await prisma.subjectComponent.findMany({
    where: { parentId: { in: subjectIds } },
    select: {
      parentId: true,
      child: { select: { characters: true, meanings: true, readings: true } },
    },
  });

  const map = new Map<string, ComponentInfo[]>();
  for (const edge of edges) {
    const meanings = edge.child.meanings as unknown as MeaningEntry[];
    const primaryMeaning = meanings.find((m) => m.primary)?.meaning ?? meanings[0]?.meaning ?? "(unknown)";
    const list = map.get(edge.parentId) ?? [];
    list.push({
      name: primaryMeaning,
      characters: edge.child.characters,
      meanings,
      readings: edge.child.readings as unknown as ReadingEntry[],
    });
    map.set(edge.parentId, list);
  }
  return map;
}

// -------------------------------------------------------------- prompt build

interface PromptResult {
  prompt: string;
  parse: (raw: unknown) => { meaningMnemonic: string; readingMnemonic?: string | null } | null;
}

function buildPromptFor(subject: SubjectRow, components: ComponentInfo[]): PromptResult {
  const meanings = subject.meanings as unknown as MeaningEntry[];
  const readings = subject.readings as unknown as ReadingEntry[];
  const metadata = subject.metadata as Record<string, unknown> | null;

  switch (subject.type) {
    case SubjectType.RADICAL: {
      const name = meanings.find((m) => m.primary)?.meaning ?? meanings[0]?.meaning ?? "(unknown)";
      return {
        prompt: buildRadicalPrompt({ name, characters: subject.characters }),
        parse: parseRadicalResponse,
      };
    }
    case SubjectType.KANJI: {
      return {
        prompt: buildKanjiPrompt({
          characters: subject.characters,
          meanings,
          readings,
          components: components.map((c) => ({ name: c.name, characters: c.characters })),
        }),
        parse: parseKanjiResponse,
      };
    }
    case SubjectType.VOCAB: {
      const reading = readings.find((r) => r.primary)?.reading ?? readings[0]?.reading ?? null;
      const irregularReading = isIrregularVocabReading(reading, components);
      return {
        prompt: buildVocabPrompt({
          characters: subject.characters,
          reading,
          meanings,
          kanjiComponents: components.map((c) => ({
            characters: c.characters,
            meaning: c.meanings.find((m) => m.primary)?.meaning ?? c.meanings[0]?.meaning ?? null,
          })),
          irregularReading,
        }),
        parse: parseVocabResponse,
      };
    }
    case SubjectType.GRAMMAR: {
      const formation = typeof metadata?.formation === "string" ? metadata.formation : null;
      const titleEn = meanings.find((m) => m.primary)?.meaning ?? meanings[0]?.meaning ?? null;
      return {
        prompt: buildGrammarPrompt({ pattern: subject.characters ?? "(unknown)", formation, titleEn }),
        parse: parseGrammarResponse,
      };
    }
    case SubjectType.KANA: {
      const romaji = meanings.find((m) => m.primary)?.meaning ?? meanings[0]?.meaning ?? null;
      const script = typeof metadata?.script === "string" ? metadata.script : "hiragana";
      return {
        prompt: buildKanaPrompt({ characters: subject.characters, romaji, script }),
        parse: parseKanaResponse,
      };
    }
    default:
      throw new Error(`Unsupported subject type for mnemonic generation: ${subject.type}`);
  }
}

/// Heuristic: a vocab reading is "irregular" if none of its kanji
/// components' recorded on/kun readings appear as a substring of the word's
/// reading. Kana-only words (no kanji components) are never irregular —
/// there's nothing to sound out against.
function isIrregularVocabReading(reading: string | null, components: ComponentInfo[]): boolean {
  if (!reading || components.length === 0) return false;
  const componentReadings = components.flatMap((c) => c.readings.map((r) => r.reading));
  if (componentReadings.length === 0) return true;
  return !componentReadings.some((r) => reading.includes(r));
}

// ---------------------------------------------------------------- batching

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RunStats {
  written: number;
  skippedMalformed: number;
}

async function processSubject(
  subject: SubjectRow,
  components: ComponentInfo[],
  client: MnemonicClient,
  flags: Flags,
): Promise<"written" | "malformed"> {
  const { prompt, parse } = buildPromptFor(subject, components);

  let raw: unknown;
  try {
    raw = await client.generate(prompt);
  } catch (err) {
    console.error(`[error] ${subject.id} (${subject.type} ${subject.characters ?? ""}): generation call failed`, err);
    return "malformed";
  }

  const parsed = parse(raw);
  if (!parsed) {
    console.error(
      `[malformed] ${subject.id} (${subject.type} ${subject.characters ?? ""}): response failed shape validation, skipping`,
      raw,
    );
    return "malformed";
  }

  if (flags.dryRun) {
    console.log(`\n--- ${subject.type} ${subject.characters ?? subject.id} ---`);
    console.log("[prompt]");
    console.log(prompt);
    console.log("[parsed response]");
    console.log(JSON.stringify(parsed, null, 2));
    return "written";
  }

  await prisma.subject.update({
    where: { id: subject.id },
    data: {
      meaningMnemonic: parsed.meaningMnemonic,
      readingMnemonic: "readingMnemonic" in parsed ? (parsed.readingMnemonic ?? null) : null,
      mnemonicSource: "generated",
    },
  });

  return "written";
}

// ------------------------------------------------------------- cost estimate

/// Very rough token estimate: ~4 chars/token for English prompt text, plus a
/// flat allowance for the JSON response. Good enough for a ballpark cost
/// warning before a real run, not meant to be precise.
function estimateTokens(promptChars: number, itemCount: number): { inputTokens: number; outputTokens: number } {
  const inputTokens = Math.ceil(promptChars / 4);
  const outputTokens = itemCount * 150; // rough allowance per mnemonic response
  return { inputTokens, outputTokens };
}

async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `);
  return new Promise((resolve) => {
    process.stdin.setEncoding("utf-8");
    process.stdin.once("data", (data) => {
      const answer = data.toString().trim().toLowerCase();
      resolve(answer === "y" || answer === "yes");
      process.stdin.pause();
    });
  });
}

// --------------------------------------------------------------------- main

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  const subjects = await selectSubjects(flags);
  if (subjects.length === 0) {
    console.log("No subjects match the given scope (nothing to generate).");
    return;
  }

  const componentsBySubject = await fetchComponents(subjects.map((s) => s.id));

  // Build prompts up front for the cost estimate and dry-run preview.
  const built = subjects.map((s) => ({
    subject: s,
    components: componentsBySubject.get(s.id) ?? [],
  }));
  const promptChars = built.reduce((sum, b) => sum + buildPromptFor(b.subject, b.components).prompt.length, 0);
  const { inputTokens, outputTokens } = estimateTokens(promptChars, subjects.length);

  console.log(`Scope: ${subjects.length} subject(s)${flags.type ? ` [type=${flags.type}]` : ""}${flags.level !== undefined ? ` [level=${flags.level}]` : ""}`);
  console.log(`Estimated tokens: ~${inputTokens.toLocaleString()} input, ~${outputTokens.toLocaleString()} output`);
  console.log(`Mode: ${flags.dryRun ? "dry-run (no writes)" : flags.mock ? "mock client (writes with fake data)" : "real API call"}`);

  if (!flags.dryRun && !flags.yes) {
    const proceed = await confirm("Proceed?");
    if (!proceed) {
      console.log("Aborted.");
      return;
    }
  }

  const client = createClient(flags.mock || flags.dryRun);
  const stats: RunStats = { written: 0, skippedMalformed: 0 };

  for (const batch of chunk(built, BATCH_SIZE)) {
    const results = await Promise.all(
      batch.map((b) => processSubject(b.subject, b.components, client, flags)),
    );
    for (const result of results) {
      if (result === "written") stats.written += 1;
      else stats.skippedMalformed += 1;
    }
    console.log(`[progress] ${stats.written + stats.skippedMalformed}/${subjects.length} processed`);
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`\nDone. Written: ${stats.written}. Skipped (malformed): ${stats.skippedMalformed}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

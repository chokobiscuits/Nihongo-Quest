// Pre-generates pronunciation clips with a local VOICEVOX engine and uploads
// them to a public Supabase Storage bucket. Runnable as
// `npm run audio:generate -- [flags]`.
//
// The UI finds a clip purely from its text (src/components/speech/
// speechAudio.ts), so this script never writes to the database: it reads
// Subject rows, derives every string the UI can speak (the shared
// `subjectSpeechTexts` helper), and uploads one MP3 per distinct string.
//
// Resumability: the bucket is listed once up front and keys that already
// exist are skipped, so re-running with the same flags continues where an
// interrupted run stopped. Bump AUDIO_VERSION in speechAudio.ts to redo all.
//
// Needs VOICEVOX running locally (the engine, default http://127.0.0.1:50021)
// and, for uploads, NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY
// (the anon key rarely has write access to a bucket). --dry-run needs
// neither the engine nor write access.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "../../src/lib/db";
import { SubjectType } from "../../src/generated/prisma/enums";
import { AUDIO_VERSION, VOICE } from "../../src/components/speech/speechAudio";
import { dedupeJobs, jobsForSubject, type AudioJob, type SubjectRow } from "./jobs";
import { synthesizeJob } from "./synth";
import { wavToMp3 } from "./wav-to-mp3";
import {
  DEFAULT_VOICEVOX_URL,
  VOICE_NAME,
  VOICE_STYLE,
  VoicevoxClient,
  findSpeakerId,
} from "./voicevox";

// ------------------------------------------------------------------- flags

const GENERATABLE_TYPES: string[] = [SubjectType.KANA, SubjectType.KANJI, SubjectType.VOCAB, SubjectType.SENTENCE];

interface Flags {
  type?: SubjectType;
  level?: number;
  limit?: number;
  scope: "ladder" | "all";
  speaker?: number;
  dryRun: boolean;
  yes: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { scope: "ladder", dryRun: false, yes: false };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--yes") flags.yes = true;
    else if (arg.startsWith("--type=")) {
      const value = arg.slice("--type=".length).toUpperCase();
      if (!GENERATABLE_TYPES.includes(value)) {
        throw new Error(`--type must be one of ${GENERATABLE_TYPES.join(", ")}, got "${value}"`);
      }
      flags.type = value as SubjectType;
    } else if (arg.startsWith("--level=")) {
      const value = Number(arg.slice("--level=".length));
      if (!Number.isInteger(value) || value < 0 || value > 60) {
        throw new Error(`--level must be an integer between 0 and 60, got "${arg}"`);
      }
      flags.level = value;
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit must be a positive integer, got "${arg}"`);
      }
      flags.limit = value;
    } else if (arg.startsWith("--scope=")) {
      const value = arg.slice("--scope=".length);
      if (value !== "ladder" && value !== "all") {
        throw new Error(`--scope must be "ladder" or "all", got "${value}"`);
      }
      flags.scope = value;
    } else if (arg.startsWith("--speaker=")) {
      const value = Number(arg.slice("--speaker=".length));
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`--speaker must be a non-negative integer style id, got "${arg}"`);
      }
      flags.speaker = value;
    } else {
      throw new Error(`Unrecognized flag: ${arg}`);
    }
  }
  return flags;
}

// -------------------------------------------------------------- selection

/// "ladder" is the 60-level curriculum (level not null); off-ladder subjects
/// are seeded reference material that lessons never schedule. --scope=all
/// also covers those, which is what grammar example sentences may need.
async function selectSubjects(flags: Flags): Promise<SubjectRow[]> {
  const where: Record<string, unknown> = {
    type: flags.type ?? { in: GENERATABLE_TYPES },
  };
  if (flags.level !== undefined) where.level = flags.level;
  else if (flags.scope === "ladder") where.level = { not: null };

  return prisma.subject.findMany({
    where,
    orderBy: [{ level: "asc" }, { slug: "asc" }],
    take: flags.limit,
    select: { id: true, type: true, slug: true, characters: true, readings: true, furigana: true },
  });
}

// ----------------------------------------------------------------- storage

const BUCKET = process.env.SPEECH_AUDIO_BUCKET || "speech-audio";
const LIST_PAGE_SIZE = 1000;

function resolveSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

/// Every existing object key in the bucket, listed one `<version>-<voice>/<hh>`
/// folder at a time (paginated) because Supabase lists a single level.
async function listExistingKeys(supabase: SupabaseClient): Promise<Set<string>> {
  const existing = new Set<string>();
  const root = `${AUDIO_VERSION}-${VOICE}`;
  for (let i = 0; i < 256; i++) {
    const hh = i.toString(16).padStart(2, "0");
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(`${root}/${hh}`, { limit: LIST_PAGE_SIZE, offset });
      if (error) throw new Error(`Listing ${BUCKET}/${root}/${hh} failed: ${error.message}`);
      for (const file of data ?? []) existing.add(`${root}/${hh}/${file.name}`);
      if (!data || data.length < LIST_PAGE_SIZE) break;
    }
  }
  return existing;
}

// ----------------------------------------------------------------- helpers

const CLIP_DELAY_MS = 100;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;
/// Clips shorter than this are almost certainly a silent or broken synthesis.
const MIN_DURATION_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

interface FailureRecord {
  key: string;
  text: string;
  label: string;
  reason: string;
}

const FAILED_REPORT = path.join(__dirname, "failed.json");

/// Synchronous so it is safe inside a SIGINT handler. Called after every
/// failure or warning, not just at the end, so a crash or Ctrl-C keeps the list.
function writeFailureReport(failures: FailureRecord[], warnings: FailureRecord[]) {
  writeFileSync(FAILED_REPORT, JSON.stringify({ failures, warnings }, null, 2), "utf-8");
}

// --------------------------------------------------------------------- main

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  const subjects = await selectSubjects(flags);
  if (subjects.length === 0) {
    console.log("No subjects match the given scope (nothing to generate).");
    return;
  }

  const { jobs, collisions } = dedupeJobs(subjects.flatMap(jobsForSubject));
  for (const [a, b] of collisions) {
    console.error(`[collision] "${a.text}" and "${b.text}" share key ${a.key}; keeping the first`);
  }

  const supabase = resolveSupabase();
  let existing = new Set<string>();
  if (supabase) {
    try {
      existing = await listExistingKeys(supabase);
    } catch (err) {
      if (!flags.dryRun) throw err;
      console.warn(`[warn] could not list the bucket (${err instanceof Error ? err.message : String(err)}); counting everything as missing`);
    }
  } else if (!flags.dryRun) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload clips.");
  } else {
    console.warn("[warn] no Supabase credentials; counting everything as missing");
  }

  const pending = jobs.filter((job) => !existing.has(job.key));
  const byKind = (list: AudioJob[]) =>
    (["kana", "word", "sentence"] as const).map((k) => `${k}=${list.filter((j) => j.kind === k).length}`).join(" ");

  console.log(
    `Scope: ${subjects.length} subject(s) [scope=${flags.scope}]${flags.type ? ` [type=${flags.type}]` : ""}${flags.level !== undefined ? ` [level=${flags.level}]` : ""}`,
  );
  console.log(`Distinct texts: ${jobs.length} (${byKind(jobs)})`);
  console.log(`Already in bucket: ${jobs.length - pending.length}; to generate: ${pending.length} (${byKind(pending)})`);
  console.log(`Mode: ${flags.dryRun ? "dry-run (no engine calls, no uploads)" : `generate and upload to "${BUCKET}"`}`);

  if (flags.dryRun) {
    for (const job of pending.slice(0, 10)) {
      console.log(`  ${job.kind.padEnd(8)} ${job.text}${job.source ? `  (from ${job.source})` : ""}  ->  ${job.key}`);
    }
    if (pending.length > 10) console.log(`  ... and ${pending.length - 10} more`);
    return;
  }

  if (pending.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const voicevox = new VoicevoxClient(process.env.VOICEVOX_URL || DEFAULT_VOICEVOX_URL);
  try {
    console.log(`VOICEVOX engine ${await voicevox.version()}`);
  } catch {
    console.error(`Cannot reach VOICEVOX at ${process.env.VOICEVOX_URL || DEFAULT_VOICEVOX_URL}. Start the VOICEVOX engine and re-run.`);
    process.exitCode = 1;
    return;
  }

  let speaker = flags.speaker;
  if (speaker === undefined) {
    const resolved = findSpeakerId(await voicevox.speakers(), VOICE_NAME, VOICE_STYLE);
    if (resolved === null) {
      throw new Error(`The engine has no ${VOICE_NAME} (${VOICE_STYLE}) voice. Install it, or pass --speaker=<style id>.`);
    }
    speaker = resolved;
  }
  console.log(`Speaker style id: ${speaker}`);

  if (!flags.yes && !(await confirm(`Generate and upload ${pending.length} clip(s)?`))) {
    console.log("Aborted.");
    return;
  }

  const failures: FailureRecord[] = [];
  const warnings: FailureRecord[] = [];
  const flushReport = () => writeFailureReport(failures, warnings);
  process.once("SIGINT", () => {
    flushReport();
    console.error(`
Interrupted. Report so far: ${FAILED_REPORT}`);
    process.exit(130);
  });
  let uploaded = 0;
  let fellBack = 0;
  let unverified = 0;

  for (const [index, job] of pending.entries()) {
    let lastError = "";
    let done = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !done; attempt++) {
      try {
        const result = await synthesizeJob(voicevox, job, speaker);
        const { mp3, durationMs } = await wavToMp3(result.wav);
        if (durationMs < MIN_DURATION_MS) {
          failures.push({ key: job.key, text: job.text, label: job.label, reason: `too short (${Math.round(durationMs)} ms)` });
          flushReport();
          console.warn(`[skip] "${job.text}" synthesized to ${Math.round(durationMs)} ms, below ${MIN_DURATION_MS} ms`);
          done = true;
          break;
        }
        const { error } = await supabase!.storage.from(BUCKET).upload(job.key, mp3, {
          contentType: "audio/mpeg",
          cacheControl: "31536000",
          upsert: true,
        });
        if (error) throw new Error(`upload failed: ${error.message}`);
        uploaded += 1;
        if (result.fallback) fellBack += 1;
        if (!result.verified) unverified += 1;
        if (result.warning) {
          warnings.push({ key: job.key, text: job.text, label: job.label, reason: result.warning });
          flushReport();
          console.warn(`[warn] "${job.text}": ${result.warning}`);
        }
        done = true;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      }
    }
    if (!done) {
      failures.push({ key: job.key, text: job.text, label: job.label, reason: lastError });
      flushReport();
      console.error(`[error] "${job.text}" (${job.label}): ${lastError}`);
    }
    if ((index + 1) % 25 === 0 || index + 1 === pending.length) {
      console.log(`[progress] ${index + 1}/${pending.length} (uploaded ${uploaded}, failed ${failures.length})`);
    }
    await sleep(CLIP_DELAY_MS);
  }

  flushReport();
  console.log(
    `\nDone. Uploaded: ${uploaded} (${fellBack} via kana fallback, ${unverified} unverified because the reading still had kanji). Failed or skipped: ${failures.length}. Warnings: ${warnings.length}.`,
  );
  console.log(`Report: ${FAILED_REPORT}`);
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

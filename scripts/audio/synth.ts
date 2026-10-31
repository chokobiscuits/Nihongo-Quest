// Per-clip synthesis strategy: which engine calls produce a clip for a job,
// and the accent/reading verification that decides between the natural
// kanji rendering and a kana fallback. Takes the engine client as an
// argument so tests can drive it with a fake.
import type { AudioJob } from "./jobs";
import {
  VoicevoxError,
  applyVoiceSettings,
  queryMoraText,
  readingsMatch,
  toKanaNotation,
  toKatakana,
  type AudioQuery,
  type ClipKind,
  type VoicevoxAccentPhrase,
} from "./voicevox";

/// Kanji (and the iteration mark) in the expected text: nothing to verify a
/// reading against, so such a job skips the check.
const KANJI_PATTERN = /[㐀-鿿々]/;

export interface SynthClient {
  audioQuery(text: string, speaker: number): Promise<AudioQuery>;
  accentPhrases(text: string, speaker: number, isKana: boolean): Promise<VoicevoxAccentPhrase[]>;
  synthesis(query: AudioQuery, speaker: number): Promise<Buffer>;
}

export interface SynthResult {
  wav: Buffer;
  /// True when the natural rendering was rejected and kana was synthesized
  /// instead (the clip is still correct, just with a plainer accent).
  fallback: boolean;
  /// False when the expected text still contains kanji (a sentence whose
  /// furigana was incomplete), so there was no reading to check against and
  /// the engine's own reading of the original characters was used.
  verified: boolean;
  /// Set when the engine's output still disagrees with the expected reading
  /// and nothing better was available; the clip is kept but worth a listen.
  warning: string | null;
}

/// Speaks kana exactly as written. Builds the accent phrases from kana
/// notation (`/accent_phrases?is_kana=true`) so no dictionary lookup can
/// change a mora, then wraps them in an ordinary query for the voice
/// settings. If the engine rejects the notation, falls back to plain
/// katakana through the normal frontend and verifies the result instead.
async function synthesizeKana(client: SynthClient, text: string, speaker: number, kind: ClipKind): Promise<SynthResult> {
  const katakana = toKatakana(text);
  let query = await client.audioQuery(katakana, speaker);
  try {
    const phrases = await client.accentPhrases(toKanaNotation(text), speaker, true);
    query = { ...query, accent_phrases: phrases };
  } catch (err) {
    // Only a rejection of the notation itself is recoverable; a dropped
    // connection should surface so the caller's retry handles it.
    if (!(err instanceof VoicevoxError) || err.status === undefined || err.status < 400 || err.status >= 500) throw err;
  }

  const actual = queryMoraText(query);
  const warning = readingsMatch(text, actual) ? null : `engine moras "${actual}" differ from "${text}"`;
  return { wav: await client.synthesis(applyVoiceSettings(query, kind), speaker), fallback: false, verified: true, warning };
}

/// Produces the WAV for one job.
///
/// kana jobs go straight through `synthesizeKana`. word and sentence jobs
/// first ask the engine to read the kanji form (`job.source`, or the text
/// itself when it has no kanji form) and compare the moras it produced with
/// the expected reading. A match keeps the natural accent; a mismatch (the
/// engine picked another reading of the kanji) falls back to speaking the
/// kana: flat accent for a word, ordinary kana-text query for a sentence.
export async function synthesizeJob(client: SynthClient, job: AudioJob, speaker: number): Promise<SynthResult> {
  if (job.kind === "kana") return synthesizeKana(client, job.text, speaker, "word");

  const clipKind: ClipKind = job.kind === "sentence" ? "sentence" : "word";
  if (KANJI_PATTERN.test(job.text)) {
    const query = await client.audioQuery(job.source ?? job.text, speaker);
    return { wav: await client.synthesis(applyVoiceSettings(query, clipKind), speaker), fallback: false, verified: false, warning: null };
  }
  const primary = job.source ?? job.text;
  const query = await client.audioQuery(primary, speaker);
  if (readingsMatch(job.text, queryMoraText(query))) {
    return { wav: await client.synthesis(applyVoiceSettings(query, clipKind), speaker), fallback: false, verified: true, warning: null };
  }

  if (job.kind === "word") {
    const result = await synthesizeKana(client, job.text, speaker, clipKind);
    return { ...result, fallback: true };
  }

  // Sentence: try the kana text through the normal frontend when we have not
  // already; otherwise keep what the engine gave us and flag it.
  const fallbackQuery = primary !== job.text ? await client.audioQuery(job.text, speaker) : query;
  const actual = queryMoraText(fallbackQuery);
  const warning = readingsMatch(job.text, actual) ? null : `engine moras "${actual}" differ from "${job.text}"`;
  return {
    wav: await client.synthesis(applyVoiceSettings(fallbackQuery, clipKind), speaker),
    fallback: true,
    verified: true,
    warning,
  };
}

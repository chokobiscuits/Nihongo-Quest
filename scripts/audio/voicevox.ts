// Thin client for a local VOICEVOX engine plus the pure helpers the audio
// generator builds on (voice settings, kana notation, reading comparison).
// Everything here is side-effect free apart from the client's HTTP calls,
// which go through an injectable `fetch` so tests never need an engine.

export type FetchLike = typeof fetch;

export interface VoicevoxMora {
  text: string;
  [key: string]: unknown;
}

export interface VoicevoxAccentPhrase {
  moras: VoicevoxMora[];
  accent: number;
  pause_mora?: VoicevoxMora | null;
  is_interrogative?: boolean;
  [key: string]: unknown;
}

export interface AudioQuery {
  accent_phrases: VoicevoxAccentPhrase[];
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  outputSamplingRate: number;
  outputStereo: boolean;
  [key: string]: unknown;
}

export interface VoicevoxSpeaker {
  name: string;
  styles: { name: string; id: number }[];
}

export class VoicevoxError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "VoicevoxError";
  }
}

export const DEFAULT_VOICEVOX_URL = "http://127.0.0.1:50021";
export const VOICE_NAME = "冥鳴ひまり";
export const VOICE_STYLE = "ノーマル";

/// Finds a style id by speaker and style name, or null when the installed
/// engine does not ship that voice.
export function findSpeakerId(speakers: VoicevoxSpeaker[], name: string, style: string): number | null {
  const speaker = speakers.find((s) => s.name === name);
  const match = speaker?.styles.find((s) => s.name === style);
  return match ? match.id : null;
}

export class VoicevoxClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string = DEFAULT_VOICEVOX_URL,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request(path: string, init: RequestInit & { query?: Record<string, string | number | boolean> } = {}) {
    const { query, ...rest } = init;
    const search = query
      ? "?" + new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
      : "";
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}${search}`, {
        ...rest,
        signal: rest.signal ?? AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new VoicevoxError(`VOICEVOX request to ${path} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new VoicevoxError(`VOICEVOX ${path} returned ${response.status}: ${body.slice(0, 200)}`, response.status);
    }
    return response;
  }

  async version(): Promise<string> {
    const response = await this.request("/version");
    return String(await response.json());
  }

  async speakers(): Promise<VoicevoxSpeaker[]> {
    const response = await this.request("/speakers");
    return (await response.json()) as VoicevoxSpeaker[];
  }

  async audioQuery(text: string, speaker: number): Promise<AudioQuery> {
    const response = await this.request("/audio_query", { method: "POST", query: { text, speaker } });
    return (await response.json()) as AudioQuery;
  }

  /// `isKana` switches `text` to AquesTalk-style kana notation, so the moras
  /// come out exactly as written instead of being guessed from a dictionary.
  async accentPhrases(text: string, speaker: number, isKana: boolean): Promise<VoicevoxAccentPhrase[]> {
    const response = await this.request("/accent_phrases", {
      method: "POST",
      query: { text, speaker, is_kana: isKana },
    });
    return (await response.json()) as VoicevoxAccentPhrase[];
  }

  /// Returns the WAV bytes for `query`.
  async synthesis(query: AudioQuery, speaker: number): Promise<Buffer> {
    const response = await this.request("/synthesis", {
      method: "POST",
      query: { speaker },
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    return Buffer.from(await response.arrayBuffer());
  }
}

// ---------------------------------------------------------------- settings

export type ClipKind = "word" | "sentence";

/// Returns a copy of `query` with the app's voice settings: slightly slow for
/// learners (0.9 words, 0.85 sentences), a touch more intonation, short
/// lead-in and tail silence, and 24 kHz mono output.
export function applyVoiceSettings(query: AudioQuery, kind: ClipKind): AudioQuery {
  const next: AudioQuery = {
    ...query,
    speedScale: kind === "sentence" ? 0.85 : 0.9,
    intonationScale: 1.05,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.15,
    outputSamplingRate: 24000,
    outputStereo: false,
  };
  // Older engines do not know this field; only set it where it exists.
  if (kind === "sentence" && "pauseLengthScale" in query) next.pauseLengthScale = 1.2;
  return next;
}

// ------------------------------------------------------------ kana helpers

/// Hiragana to katakana by code point offset. Anything else, including
/// existing katakana and the long vowel mark, passes through.
export function toKatakana(text: string): string {
  return text.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

/// Katakana to hiragana, the inverse of `toKatakana`.
export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/// Wraps kana in AquesTalk-style notation for `/accent_phrases?is_kana=true`.
/// The notation requires an accent mark; marking the final mora gives a flat
/// contour, the neutral choice for a reading spoken in isolation.
export function toKanaNotation(text: string): string {
  return `${toKatakana(text.normalize("NFC").trim())}'`;
}

/// The kana the engine will actually speak for a query, concatenated across
/// accent phrases (pause moras are dropped). Katakana, as VOICEVOX emits it.
export function queryMoraText(query: { accent_phrases: VoicevoxAccentPhrase[] }): string {
  return query.accent_phrases.map((phrase) => phrase.moras.map((m) => m.text).join("")).join("");
}

const VOWEL_ROWS: [string, string][] = [
  ["あかさたなはまやらわがざだばぱぁゃゎ", "あ"],
  ["いきしちにひみりぎじぢびぴぃ", "い"],
  ["うくすつぬふむゆるぐずづぶぷぅゅゔ", "う"],
  ["えけせてねへめれげぜでべぺぇ", "え"],
  ["おこそとのほもよろをごぞどぼぽぉょ", "お"],
];

function vowelOf(kana: string): string | null {
  if (kana.length === 0) return null;
  for (const [row, vowel] of VOWEL_ROWS) if (row.includes(kana)) return vowel;
  return null;
}

/// Reduces kana to the form it is pronounced in, so a dictionary reading and
/// the engine's mora text can be compared. Both sides go through the same
/// reduction, so it only has to be consistent, not linguistically complete:
///   - katakana becomes hiragana; punctuation, spaces and latin are dropped
///   - particles は/へ/を and historical ぢ/づ collapse to わ/え/お and じ/ず
///   - the long vowel mark expands to the vowel it lengthens, and the
///     spelled-out long vowels おう/えい collapse to おお/ええ, since the
///     engine writes both of those with a mark
/// The collapse is lenient on purpose (it also equates は and わ); the check
/// exists to catch a wrong reading, not to prove orthography.
export function normalizeKanaForCompare(input: string): string {
  let text = toHiragana(input.normalize("NFC")).replace(/[^ぁ-ゖー]/g, "");
  text = text.replace(/は/g, "わ").replace(/へ/g, "え").replace(/を/g, "お").replace(/ぢ/g, "じ").replace(/づ/g, "ず");
  // Small vowels: the engine spells ねぇ as ネエ, so treat them as full-size.
  text = text.replace(/[ぁぃぅぇぉ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 1));

  let expanded = "";
  for (const ch of text) {
    if (ch === "ー") {
      const vowel = vowelOf(expanded.slice(-1));
      if (vowel) expanded += vowel;
    } else {
      expanded += ch;
    }
  }

  return expanded
    .replace(/([おこそとのほもよろごぞどぼぽょ])う/g, "$1お")
    .replace(/([えけせてねめれげぜでべぺぇ])い/g, "$1え");
}

/// True when the engine's mora text reads the same as the expected kana.
export function readingsMatch(expected: string, actual: string): boolean {
  const a = normalizeKanaForCompare(expected);
  return a.length > 0 && a === normalizeKanaForCompare(actual);
}

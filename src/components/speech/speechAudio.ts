/// Naming scheme for the pre-generated pronunciation clips. There is no DB
/// column behind this: a clip's location is a pure function of the text that
/// is spoken, so the UI and scripts/audio/generate.ts derive the same key
/// independently and the clips never need to be looked up.
///
/// Bump AUDIO_VERSION to invalidate every clip (new voice settings, a fixed
/// pronunciation pass); the old objects are simply never requested again.
export const AUDIO_VERSION = "v1";
/// Voice slug baked into the key, so switching voice also gets a fresh
/// namespace instead of overwriting clips.
export const VOICE = "meimei-himari";

const FNV_OFFSET_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;

/// The form of `text` that is hashed and synthesized. NFC so a precomposed
/// and a decomposed dakuten hash the same; trimmed so stray whitespace never
/// forks a key.
export function normalizeSpeechText(text: string): string {
  return text.normalize("NFC").trim();
}

/// Synchronous 64-bit FNV-1a over the UTF-8 bytes of the normalized text, as
/// 16 lowercase hex chars. Not cryptographic: it only has to be stable and
/// collision-free across the few tens of thousands of clips this app has.
export function speechTextHash(text: string): string {
  let hash = FNV_OFFSET_64;
  for (const byte of new TextEncoder().encode(normalizeSpeechText(text))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * FNV_PRIME_64);
  }
  return hash.toString(16).padStart(16, "0");
}

/// Bucket-relative object key: `v1-<voice>/<hh>/<hash>.mp3`, where `hh` is
/// the last two hex chars of the hash (keeps any one folder listing small).
/// The low byte is used because FNV-1a's high byte barely varies for short
/// strings, which would pile single-kana clips into one folder.
export function speechAudioKey(text: string): string {
  const hash = speechTextHash(text);
  return `${AUDIO_VERSION}-${VOICE}/${hash.slice(-2)}/${hash}.mp3`;
}

/// Keys that returned an error this session. Remembering them stops every
/// other button for the same text from retrying a clip that is not uploaded
/// (yet), so a partial bucket degrades to browser speech quietly.
const missingKeys = new Set<string>();

export function markAudioMissing(key: string): void {
  missingKeys.add(key);
}

export function isAudioMissing(key: string): boolean {
  return missingKeys.has(key);
}

/// Test hook: forget every remembered failure.
export function clearMissingAudio(): void {
  missingKeys.clear();
}

/// Whether pre-generated clips are configured at all (the base URL is set),
/// regardless of whether a particular clip is known missing. Lets a button
/// tell "no clips here" apart from "this clip failed".
export function isSpeechAudioConfigured(
  baseUrl: string | undefined = process.env.NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL,
): boolean {
  return Boolean(baseUrl);
}

/// Public URL of the pre-generated clip for `text`, or null when no clip
/// should be requested: the base URL is unset (feature off, exactly the
/// behaviour before this existed), the text is empty, or the clip is known
/// missing. The base URL is a build-time NEXT_PUBLIC value, so the server
/// render and the client agree and there is no hydration mismatch.
export function speechAudioUrl(
  text: string,
  baseUrl: string | undefined = process.env.NEXT_PUBLIC_SPEECH_AUDIO_BASE_URL,
): string | null {
  if (!baseUrl || normalizeSpeechText(text).length === 0) return null;
  const key = speechAudioKey(text);
  if (isAudioMissing(key)) return null;
  return `${baseUrl.replace(/\/+$/, "")}/${key}`;
}

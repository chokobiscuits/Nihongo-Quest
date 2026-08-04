// Pure prompt construction, one function per SubjectType, plus the shared
// response-shape validators. Kept dependency-free (no Prisma, no fs) so this
// file can be unit-tested in isolation and tuned without touching the runner
// in generate.ts or the client in client.ts.

export interface MeaningEntry {
  meaning: string;
  primary: boolean;
}

export interface ReadingEntry {
  reading: string;
  primary: boolean;
  type?: string;
}

/// Shared instruction block appended to every prompt: originality and JSON
/// shape requirements. Centralized so a tweak (e.g. tightening the
/// originality language) applies to every subject type at once.
const COMMON_INSTRUCTIONS = `
Write an original mnemonic. Do not reproduce, paraphrase closely, or
otherwise draw on WaniKani's mnemonics, Heisig's "Remembering the Kanji"
keywords/stories, or any other existing published mnemonic system. Invent
your own vivid, memorable image from scratch.

Respond with JSON only, no markdown code fences, no commentary before or
after the JSON object.
`.trim();

// ---------------------------------------------------------------- RADICAL

export interface RadicalPromptInput {
  name: string;
  characters: string | null;
}

export interface RadicalResponse {
  meaningMnemonic: string;
}

export function buildRadicalPrompt(input: RadicalPromptInput): string {
  return `
You are writing a mnemonic for a Japanese kanji radical (a component shape
used to build kanji), for a Japanese learning app.

Radical name: ${input.name}
Character: ${input.characters ?? "(no standalone character)"}

Write a short, vivid mnemonic image that ties the shape of the character to
the name "${input.name}", so a learner can picture the shape and recall the
name (and vice versa). Keep it to 1-3 sentences.

${COMMON_INSTRUCTIONS}

Respond with a JSON object of exactly this shape:
{"meaningMnemonic": string}
`.trim();
}

export function parseRadicalResponse(raw: unknown): RadicalResponse | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.meaningMnemonic)) return null;
  return { meaningMnemonic: raw.meaningMnemonic };
}

// ------------------------------------------------------------------ KANJI

export interface KanjiComponent {
  name: string;
  characters: string | null;
}

export interface KanjiPromptInput {
  characters: string | null;
  meanings: MeaningEntry[];
  readings: ReadingEntry[];
  components: KanjiComponent[];
}

export interface KanjiResponse {
  meaningMnemonic: string;
  readingMnemonic: string;
}

export function buildKanjiPrompt(input: KanjiPromptInput): string {
  const primaryMeaning = primaryOf(input.meanings)?.meaning ?? input.meanings[0]?.meaning ?? "(unknown)";
  const onyomi = input.readings.filter((r) => r.type === "onyomi");
  const kunyomi = input.readings.filter((r) => r.type === "kunyomi");
  const primaryOnyomi = primaryOf(onyomi)?.reading ?? onyomi[0]?.reading ?? null;

  const componentsList = input.components.length > 0
    ? input.components.map((c) => `- ${c.name}${c.characters ? ` (${c.characters})` : ""}`).join("\n")
    : "(no radical components recorded)";

  return `
You are writing mnemonics for a Japanese kanji, for a Japanese learning app.
Learners study kanji as built out of radicals (component shapes), each of
which already has its own name they already know. Build the meaning
mnemonic explicitly out of the radical names below, the way you'd narrate a
short scene using those names as characters/props.

Character: ${input.characters ?? "(unknown)"}
Primary meaning: ${primaryMeaning}
All meanings: ${input.meanings.map((m) => m.meaning).join(", ")}
On'yomi: ${onyomi.map((r) => r.reading).join(", ") || "(none)"}
Kun'yomi: ${kunyomi.map((r) => r.reading).join(", ") || "(none)"}
Radical components:
${componentsList}

Write two things:
1. A meaning mnemonic that constructs the kanji's meaning ("${primaryMeaning}")
   out of its radical components' names, referencing each component by name.
2. A reading mnemonic for the primary on'yomi reading${primaryOnyomi ? ` ("${primaryOnyomi}")` : ""}
   (or the primary kun'yomi if there is no on'yomi), giving a memorable way
   to recall the sound.

${COMMON_INSTRUCTIONS}

Respond with a JSON object of exactly this shape:
{"meaningMnemonic": string, "readingMnemonic": string}
`.trim();
}

export function parseKanjiResponse(raw: unknown): KanjiResponse | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.meaningMnemonic)) return null;
  if (!isNonEmptyString(raw.readingMnemonic)) return null;
  return { meaningMnemonic: raw.meaningMnemonic, readingMnemonic: raw.readingMnemonic };
}

// ------------------------------------------------------------------- VOCAB

export interface VocabKanjiComponent {
  characters: string | null;
  meaning: string | null;
}

export interface VocabPromptInput {
  characters: string | null;
  reading: string | null;
  meanings: MeaningEntry[];
  kanjiComponents: VocabKanjiComponent[];
  /// True when the reading cannot be predicted from the kanji's normal
  /// on/kun readings (jukujikun, irregular readings) — signals the prompt to
  /// ask for a reading mnemonic as well as a meaning one.
  irregularReading: boolean;
}

export interface VocabResponse {
  meaningMnemonic: string;
  readingMnemonic: string | null;
}

export function buildVocabPrompt(input: VocabPromptInput): string {
  const primaryMeaning = primaryOf(input.meanings)?.meaning ?? input.meanings[0]?.meaning ?? "(unknown)";
  const kanjiList = input.kanjiComponents.length > 0
    ? input.kanjiComponents.map((k) => `- ${k.characters ?? "?"}: ${k.meaning ?? "(unknown meaning)"}`).join("\n")
    : "(no kanji components — kana-only word)";

  const readingInstruction = input.irregularReading
    ? `This word's reading ("${input.reading ?? "(unknown)"}") is irregular and can't be
sounded out from the kanji's normal readings, so also write a reading
mnemonic that helps recall the reading itself.`
    : `This word's reading follows its kanji's normal readings, so set
"readingMnemonic" to null.`;

  return `
You are writing a mnemonic for a Japanese vocabulary word, for a Japanese
learning app. Learners already know the meanings of the individual kanji in
this word; explain how those meanings combine into the word's meaning.

Word: ${input.characters ?? "(unknown)"}
Reading: ${input.reading ?? "(unknown)"}
Primary meaning: ${primaryMeaning}
All meanings: ${input.meanings.map((m) => m.meaning).join(", ")}
Kanji components:
${kanjiList}

Write a meaning mnemonic that shows how the kanji components' meanings
combine into "${primaryMeaning}". ${readingInstruction}

${COMMON_INSTRUCTIONS}

Respond with a JSON object of exactly this shape:
{"meaningMnemonic": string, "readingMnemonic": string | null}
`.trim();
}

export function parseVocabResponse(raw: unknown): VocabResponse | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.meaningMnemonic)) return null;
  if (raw.readingMnemonic !== null && !isNonEmptyString(raw.readingMnemonic)) return null;
  return {
    meaningMnemonic: raw.meaningMnemonic,
    readingMnemonic: raw.readingMnemonic === null ? null : raw.readingMnemonic,
  };
}

// ----------------------------------------------------------------- GRAMMAR

export interface GrammarPromptInput {
  pattern: string;
  formation: string | null;
  titleEn: string | null;
}

export interface GrammarResponse {
  meaningMnemonic: string;
}

export function buildGrammarPrompt(input: GrammarPromptInput): string {
  return `
You are writing a mnemonic for a Japanese grammar point, for a Japanese
learning app.

Pattern: ${input.pattern}
Formation: ${input.formation ?? "(unknown)"}
English gloss: ${input.titleEn ?? "(unknown)"}

Write a memorable way to recall what this pattern means and when it's used
— an association, a mini scene, or a wordplay hook a learner can latch onto.
Keep it to 1-3 sentences.

${COMMON_INSTRUCTIONS}

Respond with a JSON object of exactly this shape:
{"meaningMnemonic": string}
`.trim();
}

export function parseGrammarResponse(raw: unknown): GrammarResponse | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.meaningMnemonic)) return null;
  return { meaningMnemonic: raw.meaningMnemonic };
}

// -------------------------------------------------------------------- KANA

export interface KanaPromptInput {
  characters: string | null;
  romaji: string | null;
  script: "hiragana" | "katakana" | string;
}

export interface KanaResponse {
  meaningMnemonic: string;
}

export function buildKanaPrompt(input: KanaPromptInput): string {
  return `
You are writing a mnemonic for a Japanese ${input.script} character, for a
Japanese learning app.

Character: ${input.characters ?? "(unknown)"}
Romaji: ${input.romaji ?? "(unknown)"}

Write a short shape-based mnemonic: describe what the character's shape
looks like, and tie that image to the sound "${input.romaji ?? "(unknown)"}"
so a learner can recall the sound from the shape. Keep it to 1-2 sentences.

${COMMON_INSTRUCTIONS}

Respond with a JSON object of exactly this shape:
{"meaningMnemonic": string}
`.trim();
}

export function parseKanaResponse(raw: unknown): KanaResponse | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.meaningMnemonic)) return null;
  return { meaningMnemonic: raw.meaningMnemonic };
}

// ------------------------------------------------------------------- shared

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function primaryOf<T extends { primary: boolean }>(entries: T[]): T | undefined {
  return entries.find((e) => e.primary);
}

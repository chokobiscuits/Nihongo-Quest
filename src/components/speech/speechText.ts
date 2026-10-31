/// Turns a stored kanji reading into text a speech engine can read aloud.
/// Kun'yomi are stored with an okurigana dot ("た.べる") and affix dashes
/// ("-ざま", "ぬ-"); neither is pronounced, so strip them.
export function cleanReadingForSpeech(reading: string): string {
  return reading.replace(/[.\-]/g, "").trim();
}

/// Joins a furigana segment list into its spoken form: each segment's `rt`
/// (the kana reading) when present, otherwise the segment text itself
/// (already kana or punctuation).
export function furiganaToSpeechText(segments: { ruby: string; rt?: string }[]): string {
  return segments
    .map((s) => s.rt ?? s.ruby)
    .join("")
    .trim();
}

interface SpeechSubject {
  type: string;
  characters: string | null;
  readings: { reading: string; primary: boolean; type?: string }[];
  furigana: { ruby: string; rt?: string }[] | null;
}

/// A sentence is spoken from its furigana (the kana reading) so the engine
/// never guesses kanji readings; the raw characters are the fallback.
export function sentenceSpeechText(sentence: {
  furigana: { ruby: string; rt?: string }[] | null;
  characters: string | null;
}): string | null {
  const fromFurigana = sentence.furigana ? furiganaToSpeechText(sentence.furigana) : "";
  if (fromFurigana.length > 0) return fromFurigana;
  return sentence.characters && sentence.characters.trim().length > 0 ? sentence.characters.trim() : null;
}

/// The readings the UI offers a play button for: a vocab's kana readings, a
/// kanji's on'yomi and kun'yomi. Readings with no `type` are accepted so
/// callers that only pass `{ reading, primary }` still work. Other types
/// (romaji on radicals) are not speakable.
function speakableReadings(subject: SpeechSubject): SpeechSubject["readings"] {
  const wanted = subject.type === "VOCAB" ? ["kana"] : subject.type === "KANJI" ? ["onyomi", "kunyomi"] : [];
  return subject.readings.filter((r) => r.type === undefined || wanted.includes(r.type));
}

/// The single string to speak for a subject once its answer is revealed, or
/// null when there is nothing sensible to say. Kana speak their glyph,
/// sentences their furigana (so kanji readings are not guessed), vocab and
/// kanji their primary kana reading. Radicals and grammar patterns have no
/// reading and get no audio. Always one of `subjectSpeechTexts`.
export function subjectSpeechText(subject: SpeechSubject): string | null {
  switch (subject.type) {
    case "KANA":
      return subject.characters && subject.characters.trim().length > 0 ? subject.characters.trim() : null;
    case "SENTENCE":
      return sentenceSpeechText(subject);
    case "VOCAB":
    case "KANJI": {
      const readings = speakableReadings(subject);
      const reading = readings.find((r) => r.primary) ?? readings[0];
      const cleaned = reading ? cleanReadingForSpeech(reading.reading) : "";
      return cleaned.length > 0 ? cleaned : null;
    }
    default:
      return null;
  }
}

/// Every string the UI can speak for a subject, deduplicated: the superset
/// of `subjectSpeechText` plus each individual reading button. This is what
/// scripts/audio/generate.ts synthesizes, so anything speakable in the UI
/// has a pre-generated clip. Add new speakable text here first.
export function subjectSpeechTexts(subject: SpeechSubject): string[] {
  const texts: (string | null)[] = [];
  switch (subject.type) {
    case "KANA":
    case "SENTENCE":
      texts.push(subjectSpeechText(subject));
      break;
    case "VOCAB":
    case "KANJI":
      for (const r of speakableReadings(subject)) texts.push(cleanReadingForSpeech(r.reading));
      break;
  }
  return [...new Set(texts.filter((t): t is string => t !== null && t.length > 0))];
}

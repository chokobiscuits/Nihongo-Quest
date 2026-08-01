// KANJIDIC2 kun readings carry an okurigana marker, e.g. "た.べる": the part
// before the dot is the kanji's reading, the part after is okurigana that
// gets written in kana in real text. We keep both forms: the raw form (with
// the dot) for display, and the cleaned form (dot removed) for matching
// against actual vocab readings.

export interface CleanedKunReading {
  /// As KANJIDIC2 stores it, dot and all: "た.べる".
  raw: string;
  /// Dot removed, ready to compare against real kana text: "たべる".
  clean: string;
}

export function cleanKunReading(raw: string): CleanedKunReading {
  return { raw, clean: raw.replace(/\./g, "") };
}

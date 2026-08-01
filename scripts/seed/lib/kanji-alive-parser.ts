// Kanji Alive's 247-radical table (language-data/japanese-radicals.csv).
// Columns: Radical ID#, Stroke#, Radical, Meaning, Reading-J, Reading-R,
// R-Filename, Anim-Filename, Position-J, Position-R. We only need the
// character, English meaning, and romaji reading; the rest is left join
// bait for the radical-characters SVG set, which we do not need since
// KanjiVG supplies the actual glyph.
//
// Minimal hand-rolled CSV parser (no external dependency): the file has no
// embedded newlines and only the Meaning column can contain a comma, always
// wrapped in double quotes, so a simple quote-aware split is sufficient.
export interface KanjiAliveRadical {
  radical: string;
  meaning: string;
  readingRomaji: string;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseKanjiAliveRadicals(csv: string): KanjiAliveRadical[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]);
  const radicalIdx = header.indexOf("Radical");
  const meaningIdx = header.indexOf("Meaning");
  const readingRIdx = header.indexOf("Reading-R");

  const rows: KanjiAliveRadical[] = [];
  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);
    const radical = (fields[radicalIdx] ?? "").trim();
    // Some rows have no standalone Unicode glyph for the radical (only a
    // named position variant); skip those, there is nothing to join to
    // KanjiVG components without a literal character.
    if (!radical) continue;

    rows.push({
      radical,
      meaning: (fields[meaningIdx] ?? "").trim(),
      readingRomaji: (fields[readingRIdx] ?? "").trim(),
    });
  }
  return rows;
}

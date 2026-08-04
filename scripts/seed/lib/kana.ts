// The Japanese kana syllabaries: hand-encoded, like scripts/seed/lib/
// kangxi-radicals.ts's 214 Kangxi radicals — this is a fixed, small,
// centuries-old standard with no ambiguity worth parsing from a dictionary
// source. Covers:
//   - 46 basic hiragana + 46 basic katakana (the gojuon table, plus n/ん)
//   - dakuten/handakuten voiced forms (が ざ だ ば ぱ and katakana equivalents)
//   - youon (palatalized) combinations (きゃ きゅ きょ, ...) for both scripts
//
// `row` is the character's gojuon row (あ/か/さ/た/な/は/ま/や/ら/わ, plus ん
// on its own, and が/ざ/だ/ば/ぱ for the voiced rows, きゃ-family rows for
// youon) — used to teach in gojuon order rather than by frequency, and to
// group the browse page by row within script. `column` is the vowel column
// (a/i/u/e/o) for the plain gojuon rows, null where a row has no five-vowel
// spread (ん, and youon rows only have a/u/o).
export type KanaScript = "hiragana" | "katakana";

export interface KanaChar {
  character: string;
  romaji: string;
  script: KanaScript;
  row: string;
  column: string | null;
}

// -------------------------------------------------------------- Hiragana
const HIRAGANA_BASIC: KanaChar[] = [
  { character: "あ", romaji: "a", script: "hiragana", row: "a", column: "a" },
  { character: "い", romaji: "i", script: "hiragana", row: "a", column: "i" },
  { character: "う", romaji: "u", script: "hiragana", row: "a", column: "u" },
  { character: "え", romaji: "e", script: "hiragana", row: "a", column: "e" },
  { character: "お", romaji: "o", script: "hiragana", row: "a", column: "o" },

  { character: "か", romaji: "ka", script: "hiragana", row: "ka", column: "a" },
  { character: "き", romaji: "ki", script: "hiragana", row: "ka", column: "i" },
  { character: "く", romaji: "ku", script: "hiragana", row: "ka", column: "u" },
  { character: "け", romaji: "ke", script: "hiragana", row: "ka", column: "e" },
  { character: "こ", romaji: "ko", script: "hiragana", row: "ka", column: "o" },

  { character: "さ", romaji: "sa", script: "hiragana", row: "sa", column: "a" },
  { character: "し", romaji: "shi", script: "hiragana", row: "sa", column: "i" },
  { character: "す", romaji: "su", script: "hiragana", row: "sa", column: "u" },
  { character: "せ", romaji: "se", script: "hiragana", row: "sa", column: "e" },
  { character: "そ", romaji: "so", script: "hiragana", row: "sa", column: "o" },

  { character: "た", romaji: "ta", script: "hiragana", row: "ta", column: "a" },
  { character: "ち", romaji: "chi", script: "hiragana", row: "ta", column: "i" },
  { character: "つ", romaji: "tsu", script: "hiragana", row: "ta", column: "u" },
  { character: "て", romaji: "te", script: "hiragana", row: "ta", column: "e" },
  { character: "と", romaji: "to", script: "hiragana", row: "ta", column: "o" },

  { character: "な", romaji: "na", script: "hiragana", row: "na", column: "a" },
  { character: "に", romaji: "ni", script: "hiragana", row: "na", column: "i" },
  { character: "ぬ", romaji: "nu", script: "hiragana", row: "na", column: "u" },
  { character: "ね", romaji: "ne", script: "hiragana", row: "na", column: "e" },
  { character: "の", romaji: "no", script: "hiragana", row: "na", column: "o" },

  { character: "は", romaji: "ha", script: "hiragana", row: "ha", column: "a" },
  { character: "ひ", romaji: "hi", script: "hiragana", row: "ha", column: "i" },
  { character: "ふ", romaji: "fu", script: "hiragana", row: "ha", column: "u" },
  { character: "へ", romaji: "he", script: "hiragana", row: "ha", column: "e" },
  { character: "ほ", romaji: "ho", script: "hiragana", row: "ha", column: "o" },

  { character: "ま", romaji: "ma", script: "hiragana", row: "ma", column: "a" },
  { character: "み", romaji: "mi", script: "hiragana", row: "ma", column: "i" },
  { character: "む", romaji: "mu", script: "hiragana", row: "ma", column: "u" },
  { character: "め", romaji: "me", script: "hiragana", row: "ma", column: "e" },
  { character: "も", romaji: "mo", script: "hiragana", row: "ma", column: "o" },

  { character: "や", romaji: "ya", script: "hiragana", row: "ya", column: "a" },
  { character: "ゆ", romaji: "yu", script: "hiragana", row: "ya", column: "u" },
  { character: "よ", romaji: "yo", script: "hiragana", row: "ya", column: "o" },

  { character: "ら", romaji: "ra", script: "hiragana", row: "ra", column: "a" },
  { character: "り", romaji: "ri", script: "hiragana", row: "ra", column: "i" },
  { character: "る", romaji: "ru", script: "hiragana", row: "ra", column: "u" },
  { character: "れ", romaji: "re", script: "hiragana", row: "ra", column: "e" },
  { character: "ろ", romaji: "ro", script: "hiragana", row: "ra", column: "o" },

  { character: "わ", romaji: "wa", script: "hiragana", row: "wa", column: "a" },
  { character: "を", romaji: "wo", script: "hiragana", row: "wa", column: "o" },

  { character: "ん", romaji: "n", script: "hiragana", row: "n", column: null },
];

const HIRAGANA_DAKUTEN: KanaChar[] = [
  { character: "が", romaji: "ga", script: "hiragana", row: "ga", column: "a" },
  { character: "ぎ", romaji: "gi", script: "hiragana", row: "ga", column: "i" },
  { character: "ぐ", romaji: "gu", script: "hiragana", row: "ga", column: "u" },
  { character: "げ", romaji: "ge", script: "hiragana", row: "ga", column: "e" },
  { character: "ご", romaji: "go", script: "hiragana", row: "ga", column: "o" },

  { character: "ざ", romaji: "za", script: "hiragana", row: "za", column: "a" },
  { character: "じ", romaji: "ji", script: "hiragana", row: "za", column: "i" },
  { character: "ず", romaji: "zu", script: "hiragana", row: "za", column: "u" },
  { character: "ぜ", romaji: "ze", script: "hiragana", row: "za", column: "e" },
  { character: "ぞ", romaji: "zo", script: "hiragana", row: "za", column: "o" },

  { character: "だ", romaji: "da", script: "hiragana", row: "da", column: "a" },
  { character: "ぢ", romaji: "ji", script: "hiragana", row: "da", column: "i" },
  { character: "づ", romaji: "zu", script: "hiragana", row: "da", column: "u" },
  { character: "で", romaji: "de", script: "hiragana", row: "da", column: "e" },
  { character: "ど", romaji: "do", script: "hiragana", row: "da", column: "o" },

  { character: "ば", romaji: "ba", script: "hiragana", row: "ba", column: "a" },
  { character: "び", romaji: "bi", script: "hiragana", row: "ba", column: "i" },
  { character: "ぶ", romaji: "bu", script: "hiragana", row: "ba", column: "u" },
  { character: "べ", romaji: "be", script: "hiragana", row: "ba", column: "e" },
  { character: "ぼ", romaji: "bo", script: "hiragana", row: "ba", column: "o" },
];

const HIRAGANA_HANDAKUTEN: KanaChar[] = [
  { character: "ぱ", romaji: "pa", script: "hiragana", row: "pa", column: "a" },
  { character: "ぴ", romaji: "pi", script: "hiragana", row: "pa", column: "i" },
  { character: "ぷ", romaji: "pu", script: "hiragana", row: "pa", column: "u" },
  { character: "ぺ", romaji: "pe", script: "hiragana", row: "pa", column: "e" },
  { character: "ぽ", romaji: "po", script: "hiragana", row: "pa", column: "o" },
];

// Youon: a base kana's small-ya/yu/yo combination. `row` groups by the
// consonant family (kya/sha/cha/nya/hya/mya/rya/gya/ja(from ji)/bya/pya) so
// the browse page can show e.g. "kya row" as its own group, mirroring the
// plain gojuon rows.
const HIRAGANA_YOUON: KanaChar[] = [
  { character: "きゃ", romaji: "kya", script: "hiragana", row: "kya", column: "a" },
  { character: "きゅ", romaji: "kyu", script: "hiragana", row: "kya", column: "u" },
  { character: "きょ", romaji: "kyo", script: "hiragana", row: "kya", column: "o" },

  { character: "しゃ", romaji: "sha", script: "hiragana", row: "sha", column: "a" },
  { character: "しゅ", romaji: "shu", script: "hiragana", row: "sha", column: "u" },
  { character: "しょ", romaji: "sho", script: "hiragana", row: "sha", column: "o" },

  { character: "ちゃ", romaji: "cha", script: "hiragana", row: "cha", column: "a" },
  { character: "ちゅ", romaji: "chu", script: "hiragana", row: "cha", column: "u" },
  { character: "ちょ", romaji: "cho", script: "hiragana", row: "cha", column: "o" },

  { character: "にゃ", romaji: "nya", script: "hiragana", row: "nya", column: "a" },
  { character: "にゅ", romaji: "nyu", script: "hiragana", row: "nya", column: "u" },
  { character: "にょ", romaji: "nyo", script: "hiragana", row: "nya", column: "o" },

  { character: "ひゃ", romaji: "hya", script: "hiragana", row: "hya", column: "a" },
  { character: "ひゅ", romaji: "hyu", script: "hiragana", row: "hya", column: "u" },
  { character: "ひょ", romaji: "hyo", script: "hiragana", row: "hya", column: "o" },

  { character: "みゃ", romaji: "mya", script: "hiragana", row: "mya", column: "a" },
  { character: "みゅ", romaji: "myu", script: "hiragana", row: "mya", column: "u" },
  { character: "みょ", romaji: "myo", script: "hiragana", row: "mya", column: "o" },

  { character: "りゃ", romaji: "rya", script: "hiragana", row: "rya", column: "a" },
  { character: "りゅ", romaji: "ryu", script: "hiragana", row: "rya", column: "u" },
  { character: "りょ", romaji: "ryo", script: "hiragana", row: "rya", column: "o" },

  { character: "ぎゃ", romaji: "gya", script: "hiragana", row: "gya", column: "a" },
  { character: "ぎゅ", romaji: "gyu", script: "hiragana", row: "gya", column: "u" },
  { character: "ぎょ", romaji: "gyo", script: "hiragana", row: "gya", column: "o" },

  { character: "じゃ", romaji: "ja", script: "hiragana", row: "ja", column: "a" },
  { character: "じゅ", romaji: "ju", script: "hiragana", row: "ja", column: "u" },
  { character: "じょ", romaji: "jo", script: "hiragana", row: "ja", column: "o" },

  { character: "びゃ", romaji: "bya", script: "hiragana", row: "bya", column: "a" },
  { character: "びゅ", romaji: "byu", script: "hiragana", row: "bya", column: "u" },
  { character: "びょ", romaji: "byo", script: "hiragana", row: "bya", column: "o" },

  { character: "ぴゃ", romaji: "pya", script: "hiragana", row: "pya", column: "a" },
  { character: "ぴゅ", romaji: "pyu", script: "hiragana", row: "pya", column: "u" },
  { character: "ぴょ", romaji: "pyo", script: "hiragana", row: "pya", column: "o" },
];

// ------------------------------------------------------------- Katakana
const KATAKANA_BASIC: KanaChar[] = [
  { character: "ア", romaji: "a", script: "katakana", row: "a", column: "a" },
  { character: "イ", romaji: "i", script: "katakana", row: "a", column: "i" },
  { character: "ウ", romaji: "u", script: "katakana", row: "a", column: "u" },
  { character: "エ", romaji: "e", script: "katakana", row: "a", column: "e" },
  { character: "オ", romaji: "o", script: "katakana", row: "a", column: "o" },

  { character: "カ", romaji: "ka", script: "katakana", row: "ka", column: "a" },
  { character: "キ", romaji: "ki", script: "katakana", row: "ka", column: "i" },
  { character: "ク", romaji: "ku", script: "katakana", row: "ka", column: "u" },
  { character: "ケ", romaji: "ke", script: "katakana", row: "ka", column: "e" },
  { character: "コ", romaji: "ko", script: "katakana", row: "ka", column: "o" },

  { character: "サ", romaji: "sa", script: "katakana", row: "sa", column: "a" },
  { character: "シ", romaji: "shi", script: "katakana", row: "sa", column: "i" },
  { character: "ス", romaji: "su", script: "katakana", row: "sa", column: "u" },
  { character: "セ", romaji: "se", script: "katakana", row: "sa", column: "e" },
  { character: "ソ", romaji: "so", script: "katakana", row: "sa", column: "o" },

  { character: "タ", romaji: "ta", script: "katakana", row: "ta", column: "a" },
  { character: "チ", romaji: "chi", script: "katakana", row: "ta", column: "i" },
  { character: "ツ", romaji: "tsu", script: "katakana", row: "ta", column: "u" },
  { character: "テ", romaji: "te", script: "katakana", row: "ta", column: "e" },
  { character: "ト", romaji: "to", script: "katakana", row: "ta", column: "o" },

  { character: "ナ", romaji: "na", script: "katakana", row: "na", column: "a" },
  { character: "ニ", romaji: "ni", script: "katakana", row: "na", column: "i" },
  { character: "ヌ", romaji: "nu", script: "katakana", row: "na", column: "u" },
  { character: "ネ", romaji: "ne", script: "katakana", row: "na", column: "e" },
  { character: "ノ", romaji: "no", script: "katakana", row: "na", column: "o" },

  { character: "ハ", romaji: "ha", script: "katakana", row: "ha", column: "a" },
  { character: "ヒ", romaji: "hi", script: "katakana", row: "ha", column: "i" },
  { character: "フ", romaji: "fu", script: "katakana", row: "ha", column: "u" },
  { character: "ヘ", romaji: "he", script: "katakana", row: "ha", column: "e" },
  { character: "ホ", romaji: "ho", script: "katakana", row: "ha", column: "o" },

  { character: "マ", romaji: "ma", script: "katakana", row: "ma", column: "a" },
  { character: "ミ", romaji: "mi", script: "katakana", row: "ma", column: "i" },
  { character: "ム", romaji: "mu", script: "katakana", row: "ma", column: "u" },
  { character: "メ", romaji: "me", script: "katakana", row: "ma", column: "e" },
  { character: "モ", romaji: "mo", script: "katakana", row: "ma", column: "o" },

  { character: "ヤ", romaji: "ya", script: "katakana", row: "ya", column: "a" },
  { character: "ユ", romaji: "yu", script: "katakana", row: "ya", column: "u" },
  { character: "ヨ", romaji: "yo", script: "katakana", row: "ya", column: "o" },

  { character: "ラ", romaji: "ra", script: "katakana", row: "ra", column: "a" },
  { character: "リ", romaji: "ri", script: "katakana", row: "ra", column: "i" },
  { character: "ル", romaji: "ru", script: "katakana", row: "ra", column: "u" },
  { character: "レ", romaji: "re", script: "katakana", row: "ra", column: "e" },
  { character: "ロ", romaji: "ro", script: "katakana", row: "ra", column: "o" },

  { character: "ワ", romaji: "wa", script: "katakana", row: "wa", column: "a" },
  { character: "ヲ", romaji: "wo", script: "katakana", row: "wa", column: "o" },

  { character: "ン", romaji: "n", script: "katakana", row: "n", column: null },
];

const KATAKANA_DAKUTEN: KanaChar[] = [
  { character: "ガ", romaji: "ga", script: "katakana", row: "ga", column: "a" },
  { character: "ギ", romaji: "gi", script: "katakana", row: "ga", column: "i" },
  { character: "グ", romaji: "gu", script: "katakana", row: "ga", column: "u" },
  { character: "ゲ", romaji: "ge", script: "katakana", row: "ga", column: "e" },
  { character: "ゴ", romaji: "go", script: "katakana", row: "ga", column: "o" },

  { character: "ザ", romaji: "za", script: "katakana", row: "za", column: "a" },
  { character: "ジ", romaji: "ji", script: "katakana", row: "za", column: "i" },
  { character: "ズ", romaji: "zu", script: "katakana", row: "za", column: "u" },
  { character: "ゼ", romaji: "ze", script: "katakana", row: "za", column: "e" },
  { character: "ゾ", romaji: "zo", script: "katakana", row: "za", column: "o" },

  { character: "ダ", romaji: "da", script: "katakana", row: "da", column: "a" },
  { character: "ヂ", romaji: "ji", script: "katakana", row: "da", column: "i" },
  { character: "ヅ", romaji: "zu", script: "katakana", row: "da", column: "u" },
  { character: "デ", romaji: "de", script: "katakana", row: "da", column: "e" },
  { character: "ド", romaji: "do", script: "katakana", row: "da", column: "o" },

  { character: "バ", romaji: "ba", script: "katakana", row: "ba", column: "a" },
  { character: "ビ", romaji: "bi", script: "katakana", row: "ba", column: "i" },
  { character: "ブ", romaji: "bu", script: "katakana", row: "ba", column: "u" },
  { character: "ベ", romaji: "be", script: "katakana", row: "ba", column: "e" },
  { character: "ボ", romaji: "bo", script: "katakana", row: "ba", column: "o" },
];

const KATAKANA_HANDAKUTEN: KanaChar[] = [
  { character: "パ", romaji: "pa", script: "katakana", row: "pa", column: "a" },
  { character: "ピ", romaji: "pi", script: "katakana", row: "pa", column: "i" },
  { character: "プ", romaji: "pu", script: "katakana", row: "pa", column: "u" },
  { character: "ペ", romaji: "pe", script: "katakana", row: "pa", column: "e" },
  { character: "ポ", romaji: "po", script: "katakana", row: "pa", column: "o" },
];

const KATAKANA_YOUON: KanaChar[] = [
  { character: "キャ", romaji: "kya", script: "katakana", row: "kya", column: "a" },
  { character: "キュ", romaji: "kyu", script: "katakana", row: "kya", column: "u" },
  { character: "キョ", romaji: "kyo", script: "katakana", row: "kya", column: "o" },

  { character: "シャ", romaji: "sha", script: "katakana", row: "sha", column: "a" },
  { character: "シュ", romaji: "shu", script: "katakana", row: "sha", column: "u" },
  { character: "ショ", romaji: "sho", script: "katakana", row: "sha", column: "o" },

  { character: "チャ", romaji: "cha", script: "katakana", row: "cha", column: "a" },
  { character: "チュ", romaji: "chu", script: "katakana", row: "cha", column: "u" },
  { character: "チョ", romaji: "cho", script: "katakana", row: "cha", column: "o" },

  { character: "ニャ", romaji: "nya", script: "katakana", row: "nya", column: "a" },
  { character: "ニュ", romaji: "nyu", script: "katakana", row: "nya", column: "u" },
  { character: "ニョ", romaji: "nyo", script: "katakana", row: "nya", column: "o" },

  { character: "ヒャ", romaji: "hya", script: "katakana", row: "hya", column: "a" },
  { character: "ヒュ", romaji: "hyu", script: "katakana", row: "hya", column: "u" },
  { character: "ヒョ", romaji: "hyo", script: "katakana", row: "hya", column: "o" },

  { character: "ミャ", romaji: "mya", script: "katakana", row: "mya", column: "a" },
  { character: "ミュ", romaji: "myu", script: "katakana", row: "mya", column: "u" },
  { character: "ミョ", romaji: "myo", script: "katakana", row: "mya", column: "o" },

  { character: "リャ", romaji: "rya", script: "katakana", row: "rya", column: "a" },
  { character: "リュ", romaji: "ryu", script: "katakana", row: "rya", column: "u" },
  { character: "リョ", romaji: "ryo", script: "katakana", row: "rya", column: "o" },

  { character: "ギャ", romaji: "gya", script: "katakana", row: "gya", column: "a" },
  { character: "ギュ", romaji: "gyu", script: "katakana", row: "gya", column: "u" },
  { character: "ギョ", romaji: "gyo", script: "katakana", row: "gya", column: "o" },

  { character: "ジャ", romaji: "ja", script: "katakana", row: "ja", column: "a" },
  { character: "ジュ", romaji: "ju", script: "katakana", row: "ja", column: "u" },
  { character: "ジョ", romaji: "jo", script: "katakana", row: "ja", column: "o" },

  { character: "ビャ", romaji: "bya", script: "katakana", row: "bya", column: "a" },
  { character: "ビュ", romaji: "byu", script: "katakana", row: "bya", column: "u" },
  { character: "ビョ", romaji: "byo", script: "katakana", row: "bya", column: "o" },

  { character: "ピャ", romaji: "pya", script: "katakana", row: "pya", column: "a" },
  { character: "ピュ", romaji: "pyu", script: "katakana", row: "pya", column: "u" },
  { character: "ピョ", romaji: "pyo", script: "katakana", row: "pya", column: "o" },
];

export const HIRAGANA: KanaChar[] = [
  ...HIRAGANA_BASIC,
  ...HIRAGANA_DAKUTEN,
  ...HIRAGANA_HANDAKUTEN,
  ...HIRAGANA_YOUON,
];

export const KATAKANA: KanaChar[] = [
  ...KATAKANA_BASIC,
  ...KATAKANA_DAKUTEN,
  ...KATAKANA_HANDAKUTEN,
  ...KATAKANA_YOUON,
];

// Hiragana before katakana, gojuon row order preserved within each script —
// this is also the order kana is taught in (see kana-level.ts).
export const ALL_KANA: KanaChar[] = [...HIRAGANA, ...KATAKANA];

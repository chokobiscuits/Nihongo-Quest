// Hand-encoded tutorial content, following the Kangxi-radical precedent
// (scripts/seed/lib/kangxi-radicals.ts): a fixed, small, source-of-truth
// constant loaded by a seed step (scripts/seed/load-tutorials.ts), never
// derived from an external dataset. `trigger` mirrors the discriminated
// union in src/services/tutorials/trigger-types.ts — kept as a plain object
// literal here (not imported) so this file has zero dependency on the app's
// generated Prisma types and stays trivially reviewable as content.
//
// `body` is seeded on create only and never overwritten on update, same
// treatment as Subject's USER-AUTHORED block — see load-tutorials.ts.
export interface TutorialSeed {
  slug: string;
  order: number;
  titleEn: string;
  titleJa: string;
  body: string;
  trigger: Record<string, unknown>;
  required: boolean;
  estimatedMinutes: number;
}

export const TUTORIALS: TutorialSeed[] = [
  // ------------------------------------------------------------- Full (4)
  {
    slug: "how-this-app-works",
    order: 1,
    titleEn: "How this app works",
    titleJa: "このアプリの仕組み",
    required: true,
    estimatedMinutes: 3,
    trigger: { kind: "first_launch" },
    body: `# How this app works

This app teaches Japanese using **spaced repetition (SRS)**: instead of drilling everything every day, each item you learn comes back for review right before you're likely to forget it. Answer correctly and the interval grows: 4 hours, 8 hours, a day, two days, a week, and on up through **Guru**, **Master**, **Enlightened**, and finally **Burned**, where an item is retired from review because you've proven you know it long-term. Answer incorrectly and the item drops back down the ladder, so mistakes cost you time but never lock you out.

Content is organized into a **curriculum ladder**: radicals (部首, *bushu*) at the bottom, then kanji built from those radicals, then vocabulary built from those kanji, then example sentences built from that vocabulary. You unlock a new **level** by getting enough of your current level's kanji to Guru, not by waiting out a timer. There are no daily caps and no artificial delays: the pace is entirely set by how consistently you review, not by the calendar.

Two question types drive most reviews: **meaning** (what does this mean in English?) and **reading** (how is this pronounced?). Radicals only ever ask meaning, since they're building blocks, not real words with pronunciations of their own.

A worked example: 水 (みず, "water") is a level-appropriate kanji built from the radical 水 ("water") itself. Some kanji *are* their own radical, which is normal and covered in the next tutorial. Once you've learned 水 the kanji, vocabulary like 水曜日 (すいようび, "Wednesday") becomes available, because every kanji inside it is now something you've started learning.

Nothing here is timed or graded against a clock. Learn at whatever pace keeps reviews manageable: the SRS intervals do the pacing work for you.`,
  },
  {
    slug: "what-are-radicals",
    order: 3,
    titleEn: "What are radicals?",
    titleJa: "部首とは？",
    required: true,
    estimatedMinutes: 3,
    trigger: { kind: "before_first", subjectType: "RADICAL" },
    body: `# What are radicals?

Radicals (部首, *bushu*) are the visual building blocks kanji are made of: strokes and stroke-groups that recur across hundreds of different characters. This app uses the traditional 214 Kangxi radicals, the same set Japanese dictionaries have organized kanji by for centuries.

Radicals come first in the curriculum because they make kanji learnable instead of memorizable. A kanji like 語 ("language, word") looks intimidating as a blob of 14 strokes, but it's actually just three familiar pieces stacked together: 言 ("speech"), 五 ("five"), and 口 ("mouth"). Once you know those three radicals, 語 stops being a new shape to memorize from scratch and becomes a shape you already recognize, arranged in a new way. This is the whole point of learning radicals first: it turns "memorize thousands of unique pictures" into "recognize a few hundred pieces and how they combine."

Some radicals are also complete kanji in their own right. 水 ("water"), 火 ("fire"), 木 ("tree"), and 人 ("person") are all real, usable kanji that also function as radicals inside larger characters. 木 alone means "tree," but it also appears inside 林 ("woods," two trees) and 森 ("forest," three trees). When you see a radical that looks exactly like a kanji you'll learn later, that's not a coincidence: it's the same shape doing double duty.

A few radicals change form depending on where they sit in a kanji. 水 ("water") becomes the three-stroke shape 氵 when it appears on the left side of a character, as in 海 (うみ, "sea") or 泳 (およ-ぐ, "to swim"). This app tracks those variant forms so you can still recognize the radical even when it doesn't look exactly like its standalone form.

You won't be quizzed on how to pronounce a radical, only what it means. Pronunciation quizzing starts with kanji, covered next.`,
  },
  {
    slug: "meaning-vs-reading",
    order: 4,
    titleEn: "Meaning vs. reading",
    titleJa: "意味と読み",
    required: true,
    estimatedMinutes: 3,
    trigger: { kind: "before_first", subjectType: "KANJI" },
    body: `# Meaning vs. reading

Every kanji you learn gets quizzed two different ways: **meaning** (what does it mean?) and **reading** (how do you say it?). These are separate skills that happen to share the same character, and this app tracks your progress on each independently: you can be confident on a kanji's meaning while still shaky on its reading, or the reverse.

Meaning questions ask for the English gloss: shown 水, you answer "water." Straightforward, and usually the easier half.

Reading questions are harder because, unlike an alphabet, **a single kanji can have multiple valid pronunciations**, and which one is correct depends on context, specifically on which word the kanji appears in. Take 生, meaning "life" or "birth." It's read せい in 学生 (がくせい, "student"), しょう in 一生 (いっしょう, "a lifetime"), う in 生まれる (うまれる, "to be born"), and い in 生きる (いきる, "to live"). Four different pronunciations, one character, all correct, just for different words.

This app always quizzes a kanji's reading using **its most common individual reading** in isolation, but once you move on to vocabulary, you'll see how the *same* kanji shifts pronunciation inside different words. That shift has its own name and its own tutorial (onyomi vs. kunyomi) once you reach vocab. For now, the important habit is: don't assume a kanji has one "true" pronunciation. It has a most-common one, and a set of others that context will teach you.

If a reading question stumps you, that's normal: readings take longer to solidify than meanings, especially early on. The SRS will bring it back sooner than an already-solid item, which is exactly the point.`,
  },
  {
    slug: "onyomi-vs-kunyomi",
    order: 6,
    titleEn: "Onyomi vs. kunyomi",
    titleJa: "音読みと訓読み",
    required: true,
    estimatedMinutes: 4,
    trigger: { kind: "before_first", subjectType: "VOCAB" },
    body: `# Onyomi vs. kunyomi

Now that you're learning vocabulary, you'll notice the same kanji sounds different depending on the word it's in. This isn't random: it comes from Japanese having **two families of readings** for most kanji: *onyomi* (音読み, the "sound reading") and *kunyomi* (訓読み, the "meaning reading").

**Onyomi** is Japan's borrowing of the original Chinese pronunciation, adapted to Japanese phonetics, brought over along with the character itself around the 5th to 9th centuries. Onyomi readings are typically short (often one or two syllables) and show up heavily in **compound words made of two or more kanji**, especially formal, technical, or Chinese-derived vocabulary. 山 ("mountain") read as さん in 富士山 (ふじさん, "Mount Fuji") is onyomi.

**Kunyomi** is the native Japanese word for the same *concept*, with the kanji attached to it afterward as a label. Kunyomi readings are often longer and show up when a kanji stands **alone as a native Japanese word**, frequently with trailing hiragana (*okurigana*) attached, like the いく in 行く (いく, "to go") or the たかい in 高い (たかい, "tall/expensive"). 山 read as やま in 山登り (やまのぼり, "mountain climbing," here as the plain word "mountain") is kunyomi.

Neither reading is more "correct": they're both the real pronunciation, just for different situations. Since you already know 生 has readings せい, しょう, う, and い from the previous tutorial: せい and しょう are its onyomi (used in compounds like 学生, 一生), while う and い are its kunyomi (used in native verbs like 生まれる, 生きる).

There's no shortcut to memorizing which reading applies where. It comes from learning the actual words. That's exactly what vocabulary items in this app are for: each one teaches you a specific kanji-reading pairing in the context it's actually used, so the pattern builds up naturally instead of needing to be memorized as an abstract rule.`,
  },

  // ---------------------------------------------------------- Stubs (14)
  {
    slug: "reading-japanese",
    order: 2,
    titleEn: "Reading Japanese text",
    titleJa: "日本語の読み方",
    required: true,
    estimatedMinutes: 2,
    trigger: { kind: "first_launch" },
    body: `# Reading Japanese text

Japanese is written with three scripts mixed together in the same sentence: hiragana, katakana, and kanji. Each one does a different job.

**Hiragana** (ひらがな) is a native Japanese script of 46 basic characters, each standing for one syllable sound. It carries the grammar: particles like は and を, verb and adjective endings (*okurigana*), and any native word that doesn't have a kanji assigned to it.

**Katakana** (カタカナ) is a second, separate set of 46 characters that represent the exact same sounds as hiragana, just with different shapes. It's used for loanwords borrowed from other languages, onomatopoeia, and for emphasis, roughly the role italics play in English. コーヒー ("coffee," from English) and わんわん vs. ワンワン (a dog's bark, sometimes written in katakana for emphasis) are typical uses.

So hiragana and katakana are, in effect, two alphabets for the same one sound system: あ and ア are both "a," か and カ are both "ka," さ and サ are both "sa." Learn the sound once and you've learned both scripts for it.

**Kanji** (漢字) are the characters borrowed from Chinese, and unlike hiragana and katakana they carry meaning, not just sound. A single kanji can be a whole word (水, "water") or a meaning-bearing root inside a longer word (水曜日, "Wednesday," literally "water-day"). This app's radical and kanji tracks teach you how to read and recognize these.

Here's why real sentences mix all three. Take 私は猫が好きです ("I like cats"):

- 私 (わたし, "I") and 猫 (ねこ, "cat") are kanji, carrying the core meaning.
- は and が are hiragana particles marking grammatical role, and です is a hiragana grammar ending.
- 好き (すき, "to like") pairs a kanji root with okurigana in hiragana.

If this were a sentence about a loanword instead, say "I like coffee," 好き would stay the same but "coffee" would appear in katakana: 私はコーヒーが好きです。

Kanji alone would be unreadable without grammar to connect the pieces, and grammar alone has no compact way to carry specific meanings like "cat" or "water." Katakana flags "this word came from outside Japanese" so a reader instantly knows not to expect a native root. All three together are what makes a Japanese sentence readable at a glance once you know them.

This app assumes you can already read hiragana and katakana. It focuses on kanji, vocabulary, and sentences built from them. If kana isn't solid yet, a dedicated kana practice module is planned as a later addition. Until then, treat the 92 basic kana characters as prerequisite reading, the same way you'd expect to know the alphabet before starting a language course.`,
  },
  {
    slug: "how-to-answer",
    order: 5,
    titleEn: "How to answer a question",
    titleJa: "答え方",
    required: true,
    estimatedMinutes: 2,
    trigger: { kind: "before_first", subjectType: "KANJI" },
    body: "## How to answer a question\n\nReviews ask you one of two things, and the banner above the input always tells you which.\n\n**Meaning questions** want English. Type what the item means: for 山 you would type *mountain*. Minor typos are forgiven, so *mountian* still passes. If you type something the app rejects but you believe is right, use the \"I should have been marked correct\" button. That adds your answer to the accepted list permanently, so you will never be marked wrong for it again.\n\n**Reading questions** want Japanese. Type in romaji and it converts to kana as you go: typing `yama` produces やま. You do not need a Japanese keyboard.\n\n### The two mistakes everyone makes\n\nTyping the meaning when the reading was asked, or the reverse. The app catches this and tells you rather than marking you wrong, so it costs you nothing, but read the banner and it will not happen.\n\nThe other is the wrong reading for the right kanji. 山 alone is やま, but in 火山 it is さん. Reviews ask for the reading in the context they show you, so read the whole item before answering.\n\n### Wrong answers\n\nA wrong answer sends the item back into the queue for the same session, and you have to get it right before the session ends. That is deliberate: the point is to leave having learned it, not to be scored.",
  },
  {
    slug: "rendaku",
    order: 7,
    titleEn: "Rendaku: when sounds shift",
    titleJa: "連濁",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "first_multi_kanji_word" },
    body: "Rendaku is when a word's leading consonant softens in a compound: か becomes が, た becomes だ, like 人 (ひと) becoming びと in 若人 (わこうど). It's common and not an error in what you're seeing.",
  },
  {
    slug: "particles-and-word-order",
    order: 8,
    titleEn: "Particles and word order",
    titleJa: "助詞と語順",
    required: true,
    estimatedMinutes: 2,
    trigger: { kind: "before_first", subjectType: "SENTENCE" },
    body: "## Particles and word order\n\nJapanese sentences end with the verb. Where English says *I eat sushi*, Japanese says 私はすしを食べます, literally *I, sushi, eat*. Once you expect the verb last, sentences stop feeling scrambled.\n\nWhat holds the sentence together is not word order but **particles**: small kana that follow a word and label its job.\n\n### The ones you will meet first\n\n**は** marks the topic, what the sentence is about. Written は but pronounced *wa*, which catches everyone once.\n\n**を** marks the direct object, the thing the verb acts on. Written を, pronounced *o*.\n\n**に** marks a destination or a point in time: 学校に行く, go to school. 三時に, at three.\n\n**で** marks where an action happens, or what you did it with: 家で食べる, eat at home.\n\n**の** connects two nouns, usually possession: 私の本, my book.\n\n### Why this matters more than order\n\nBecause the particle carries the role, you can move words around and the meaning holds. すしを私は食べます is unusual but still means I eat sushi, because を still marks the sushi as the thing eaten. English cannot do this: *sushi eats I* is a different sentence entirely.\n\nThe trade is that a wrong particle changes your meaning completely, whereas a wrong word order mostly just sounds odd. Particles are worth more attention than they look.",
  },
  {
    slug: "no-spaces",
    order: 9,
    titleEn: "Why there are no spaces",
    titleJa: "分かち書きをしない理由",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "before_first", subjectType: "SENTENCE" },
    body: "Japanese sentences are written with no spaces between words. The mix of kanji and kana provides enough visual boundary cues that native readers don't need them.",
  },
  {
    slug: "okurigana",
    order: 10,
    titleEn: "Okurigana",
    titleJa: "送り仮名",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 3 },
    body: "Okurigana are the trailing hiragana attached to a kanji, like the く in 書く (かく, \"to write\"). They carry the inflection so the kanji itself can stay fixed across verb forms.",
  },
  {
    slug: "verb-groups",
    order: 11,
    titleEn: "Verb groups",
    titleJa: "動詞の種類",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 5 },
    body: "Japanese verbs fall into three conjugation groups: ichidan, godan, and the two irregulars する/来る. Knowing which group a verb belongs to tells you how it conjugates.",
  },
  {
    slug: "politeness-levels",
    order: 12,
    titleEn: "Politeness levels",
    titleJa: "敬語のレベル",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 8 },
    body: "Japanese has distinct plain, polite, and honorific registers. The same sentence can be phrased several ways depending on who you're speaking to.",
  },
  {
    slug: "transitive-intransitive",
    order: 13,
    titleEn: "Transitive vs. intransitive verbs",
    titleJa: "他動詞と自動詞",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 12 },
    body: "Many Japanese verbs come in transitive/intransitive pairs, like 開ける (あける, \"to open something\") and 開く (あく, \"to open by itself\"). The pairing tells you whether the subject acts or is acted upon.",
  },
  {
    slug: "counters",
    order: 14,
    titleEn: "Counters",
    titleJa: "助数詞",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 15 },
    body: "Japanese uses different counting words depending on what's being counted. Flat objects, long objects, people, and more each have their own counter suffix.",
  },
  {
    slug: "what-is-guru",
    order: 15,
    titleEn: "What is Guru?",
    titleJa: "グルとは？",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "first_guru" },
    body: "Guru is the stage where an item graduates from daily review into weekly review. It's the milestone this app treats as \"you know this now,\" even though it keeps coming back to make sure.",
  },
  {
    slug: "srs-ladder",
    order: 16,
    titleEn: "The full SRS ladder",
    titleJa: "SRSの段階",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "first_burn" },
    body: "Burned means an item has proven long-term retention and drops out of review entirely. Congratulations on burning your first item, here's the full stage ladder that got it there.",
  },
  {
    slug: "jlpt-explained",
    order: 17,
    titleEn: "What is the JLPT?",
    titleJa: "JLPTとは？",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "manual" },
    body: "The JLPT (Japanese Language Proficiency Test) is a standardized 5-level exam (N5 easiest to N1 hardest) that this app's kanji and vocab are cross-referenced against for reference, though the app's own level ladder is independent of it.",
  },
  {
    slug: "furigana-explained",
    order: 18,
    titleEn: "Furigana explained",
    titleJa: "ふりがなとは？",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "manual" },
    body: "Furigana are small kana printed above (or beside) a kanji to show its pronunciation in that specific word. This app shows them automatically wherever they help.",
  },
];

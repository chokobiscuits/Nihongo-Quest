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

Content is organized into a **curriculum ladder**: radicals (<ruby>部<rt>ぶ</rt></ruby><ruby>首<rt>しゅ</rt></ruby>, *bushu*) at the bottom, then kanji built from those radicals, then vocabulary built from those kanji, then example sentences built from that vocabulary. You unlock a new **level** by getting enough of your current level's kanji to Guru, not by waiting out a timer. There are no daily caps and no artificial delays: the pace is entirely set by how consistently you review, not by the calendar.

Two question types drive most reviews: **meaning** (what does this mean in English?) and **reading** (how is this pronounced?). Radicals only ever ask meaning, since they're building blocks, not real words with pronunciations of their own.

A worked example: <ruby>水<rt>みず</rt></ruby> ("water") is a level-appropriate kanji built from the radical <ruby>水<rt>みず</rt></ruby> ("water") itself. Some kanji *are* their own radical, which is normal and covered in the next tutorial. Once you've learned <ruby>水<rt>みず</rt></ruby> the kanji, vocabulary like <ruby>水<rt>すい</rt></ruby><ruby>曜<rt>よう</rt></ruby><ruby>日<rt>び</rt></ruby> ("Wednesday") becomes available, because every kanji inside it is now something you've started learning.

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

Radicals (<ruby>部<rt>ぶ</rt></ruby><ruby>首<rt>しゅ</rt></ruby>, *bushu*) are the visual building blocks kanji are made of: strokes and stroke-groups that recur across hundreds of different characters. This app uses the traditional 214 Kangxi radicals, the same set Japanese dictionaries have organized kanji by for centuries.

Radicals come first in the curriculum because they make kanji learnable instead of memorizable. A kanji like <ruby>語<rt>ご</rt></ruby> ("language, word") looks intimidating as a blob of 14 strokes, but it's actually just three familiar pieces stacked together: <ruby>言<rt>こと</rt></ruby> ("speech"), <ruby>五<rt>ご</rt></ruby> ("five"), and <ruby>口<rt>くち</rt></ruby> ("mouth"). Once you know those three radicals, <ruby>語<rt>ご</rt></ruby> stops being a new shape to memorize from scratch and becomes a shape you already recognize, arranged in a new way. This is the whole point of learning radicals first: it turns "memorize thousands of unique pictures" into "recognize a few hundred pieces and how they combine."

Some radicals are also complete kanji in their own right. <ruby>水<rt>みず</rt></ruby> ("water"), <ruby>火<rt>ひ</rt></ruby> ("fire"), <ruby>木<rt>き</rt></ruby> ("tree"), and <ruby>人<rt>ひと</rt></ruby> ("person") are all real, usable kanji that also function as radicals inside larger characters. <ruby>木<rt>き</rt></ruby> alone means "tree," but it also appears inside <ruby>林<rt>はやし</rt></ruby> ("woods," two trees) and <ruby>森<rt>もり</rt></ruby> ("forest," three trees). When you see a radical that looks exactly like a kanji you'll learn later, that's not a coincidence: it's the same shape doing double duty.

A few radicals change form depending on where they sit in a kanji. <ruby>水<rt>みず</rt></ruby> ("water") becomes the three-stroke shape 氵 when it appears on the left side of a character, as in <ruby>海<rt>うみ</rt></ruby> ("sea") or <ruby>泳<rt>およ</rt></ruby>ぐ ("to swim"). This app tracks those variant forms so you can still recognize the radical even when it doesn't look exactly like its standalone form.

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

Meaning questions ask for the English gloss: shown <ruby>水<rt>みず</rt></ruby>, you answer "water." Straightforward, and usually the easier half.

Reading questions are harder because, unlike an alphabet, **a single kanji can have multiple valid pronunciations**, and which one is correct depends on context, specifically on which word the kanji appears in. Take 生, meaning "life" or "birth." It's read せい in <ruby>学<rt>がく</rt></ruby><ruby>生<rt>せい</rt></ruby> ("student"), しょう in <ruby>一<rt>いっ</rt></ruby><ruby>生<rt>しょう</rt></ruby> ("a lifetime"), う in <ruby>生<rt>う</rt></ruby>まれる ("to be born"), and い in <ruby>生<rt>い</rt></ruby>きる ("to live"). Four different pronunciations, one character, all correct, just for different words.

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

Now that you're learning vocabulary, you'll notice the same kanji sounds different depending on the word it's in. This isn't random: it comes from Japanese having **two families of readings** for most kanji: *onyomi* (<ruby>音<rt>おん</rt></ruby><ruby>読<rt>よ</rt></ruby>み, the "sound reading") and *kunyomi* (<ruby>訓<rt>くん</rt></ruby><ruby>読<rt>よ</rt></ruby>み, the "meaning reading").

**Onyomi** is Japan's borrowing of the original Chinese pronunciation, adapted to Japanese phonetics, brought over along with the character itself around the 5th to 9th centuries. Onyomi readings are typically short (often one or two syllables) and show up heavily in **compound words made of two or more kanji**, especially formal, technical, or Chinese-derived vocabulary. <ruby>山<rt>やま</rt></ruby> ("mountain") read as さん in <ruby>富<rt>ふ</rt></ruby><ruby>士<rt>じ</rt></ruby><ruby>山<rt>さん</rt></ruby> ("Mount Fuji") is onyomi.

**Kunyomi** is the native Japanese word for the same *concept*, with the kanji attached to it afterward as a label. Kunyomi readings are often longer and show up when a kanji stands **alone as a native Japanese word**, frequently with trailing hiragana (*okurigana*) attached, like the いく in <ruby>行<rt>い</rt></ruby>く ("to go") or the たかい in <ruby>高<rt>たか</rt></ruby>い ("tall/expensive"). <ruby>山<rt>やま</rt></ruby> read as やま in <ruby>山<rt>やま</rt></ruby><ruby>登<rt>のぼ</rt></ruby>り ("mountain climbing," here as the plain word "mountain") is kunyomi.

Neither reading is more "correct": they're both the real pronunciation, just for different situations. Since you already know 生 has readings せい, しょう, う, and い from the previous tutorial: せい and しょう are its onyomi (used in compounds like <ruby>学<rt>がく</rt></ruby><ruby>生<rt>せい</rt></ruby>, <ruby>一<rt>いっ</rt></ruby><ruby>生<rt>しょう</rt></ruby>), while う and い are its kunyomi (used in native verbs like <ruby>生<rt>う</rt></ruby>まれる, <ruby>生<rt>い</rt></ruby>きる).

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

**Kanji** (<ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby>) are the characters borrowed from Chinese, and unlike hiragana and katakana they carry meaning, not just sound. A single kanji can be a whole word (<ruby>水<rt>みず</rt></ruby>, "water") or a meaning-bearing root inside a longer word (<ruby>水<rt>すい</rt></ruby><ruby>曜<rt>よう</rt></ruby><ruby>日<rt>び</rt></ruby>, "Wednesday," literally "water-day"). This app's radical and kanji tracks teach you how to read and recognize these.

Here's why real sentences mix all three. Take <ruby>私<rt>わたし</rt></ruby>は<ruby>猫<rt>ねこ</rt></ruby>が<ruby>好<rt>す</rt></ruby>きです ("I like cats"):

- <ruby>私<rt>わたし</rt></ruby> ("I") and <ruby>猫<rt>ねこ</rt></ruby> ("cat") are kanji, carrying the core meaning.
- は and が are hiragana particles marking grammatical role, and です is a hiragana grammar ending.
- <ruby>好<rt>す</rt></ruby>き ("to like") pairs a kanji root with okurigana in hiragana.

If this were a sentence about a loanword instead, say "I like coffee," <ruby>好<rt>す</rt></ruby>き would stay the same but "coffee" would appear in katakana: <ruby>私<rt>わたし</rt></ruby>はコーヒーが<ruby>好<rt>す</rt></ruby>きです。

Kanji alone would be unreadable without grammar to connect the pieces, and grammar alone has no compact way to carry specific meanings like "cat" or "water." Katakana flags "this word came from outside Japanese" so a reader instantly knows not to expect a native root. All three together are what makes a Japanese sentence readable at a glance once you know them.

This app includes a full kana track covering all 208 kana characters across 10 curriculum levels. You can learn kana within the app, or skip it entirely if you already know both hiragana and katakana. Either way, the kana gate ensures you've settled kana (passed all of it to Guru or explicitly skipped it outright) before unlocking radicals, because recognizing the scripts is a prerequisite to recognizing how they build into kanji.`,
  },
  {
    slug: "how-to-answer",
    order: 5,
    titleEn: "How to answer a question",
    titleJa: "答え方",
    required: true,
    estimatedMinutes: 2,
    trigger: { kind: "before_first", subjectType: "KANJI" },
    body: "## How to answer a question\n\nReviews ask you one of two things, and the banner above the input always tells you which.\n\n**Meaning questions** want English. Type what the item means: for <ruby>山<rt>やま</rt></ruby> you would type *mountain*. Minor typos are forgiven, so *mountian* still passes. If you type something the app rejects but you believe is right, use the \"I should have been marked correct\" button. That adds your answer to the accepted list permanently, so you will never be marked wrong for it again.\n\n**Reading questions** want Japanese. Type in romaji and it converts to kana as you go: typing `yama` produces やま. You do not need a Japanese keyboard.\n\n### The two mistakes everyone makes\n\nTyping the meaning when the reading was asked, or the reverse. The app catches this and tells you rather than marking you wrong, so it costs you nothing, but read the banner and it will not happen.\n\nThe other is the wrong reading for the right kanji. <ruby>山<rt>やま</rt></ruby> alone is やま, but in <ruby>火<rt>か</rt></ruby><ruby>山<rt>ざん</rt></ruby> it is さん. Reviews ask for the reading in the context they show you, so read the whole item before answering.\n\n### Wrong answers\n\nA wrong answer sends the item back into the queue for the same session, and you have to get it right before the session ends. That is deliberate: the point is to leave having learned it, not to be scored.",
  },
  {
    slug: "rendaku",
    order: 7,
    titleEn: "Rendaku: when sounds shift",
    titleJa: "連濁",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "first_multi_kanji_word" },
    body: `## Rendaku: when sounds shift

**Rendaku** (<ruby>連<rt>れん</rt></ruby><ruby>濁<rt>だく</rt></ruby>, literally "sound voicing") happens when you join two kanji into a compound word. The first sound of the second kanji softens: か becomes が, た becomes だ, さ becomes ざ, and so on.

A simple example: <ruby>山<rt>やま</rt></ruby> ("mountain") by itself is read やま. But in <ruby>火<rt>か</rt></ruby><ruby>山<rt>ざん</rt></ruby> ("volcano," literally "fire-mountain"), the さ in <ruby>山<rt>やま</rt></ruby> becomes ざ. The kanji <ruby>山<rt>やま</rt></ruby> hasn't changed, and <ruby>火<rt>ひ</rt></ruby> hasn't changed, but the compound has a different sound because the second part of the word softens when it joins the first.

This happens so often in Japanese that it's not an irregularity to memorize: it's a regular, predictable pattern. If you see a vocabulary word where a kanji's reading looks different from its standalone reading, check whether it's in a compound. Chances are very good that rendaku is what you're seeing, and it's exactly correct.`,
  },
  {
    slug: "particles-and-word-order",
    order: 8,
    titleEn: "Particles and word order",
    titleJa: "助詞と語順",
    required: true,
    estimatedMinutes: 2,
    trigger: { kind: "before_first", subjectType: "SENTENCE" },
    body: "## Particles and word order\n\nJapanese sentences end with the verb. Where English says *I eat sushi*, Japanese says <ruby>私<rt>わたし</rt></ruby>はすしを<ruby>食<rt>た</rt></ruby>べます, literally *I, sushi, eat*. Once you expect the verb last, sentences stop feeling scrambled.\n\nWhat holds the sentence together is not word order but **particles**: small kana that follow a word and label its job.\n\n### The ones you will meet first\n\n**は** marks the topic, what the sentence is about. Written は but pronounced *wa*, which catches everyone once.\n\n**を** marks the direct object, the thing the verb acts on. Written を, pronounced *o*.\n\n**に** marks a destination or a point in time: <ruby>学<rt>がっ</rt></ruby><ruby>校<rt>こう</rt></ruby>に<ruby>行<rt>い</rt></ruby>く, go to school. <ruby>三<rt>さん</rt></ruby><ruby>時<rt>じ</rt></ruby>に, at three.\n\n**で** marks where an action happens, or what you did it with: <ruby>家<rt>いえ</rt></ruby>で<ruby>食<rt>た</rt></ruby>べる, eat at home.\n\n**の** connects two nouns, usually possession: <ruby>私<rt>わたし</rt></ruby>の<ruby>本<rt>ほん</rt></ruby>, my book.\n\n### Why this matters more than order\n\nBecause the particle carries the role, you can move words around and the meaning holds. すしを<ruby>私<rt>わたし</rt></ruby>は<ruby>食<rt>た</rt></ruby>べます is unusual but still means I eat sushi, because を still marks the sushi as the thing eaten. English cannot do this: *sushi eats I* is a different sentence entirely.\n\nThe trade is that a wrong particle changes your meaning completely, whereas a wrong word order mostly just sounds odd. Particles are worth more attention than they look.",
  },
  {
    slug: "no-spaces",
    order: 9,
    titleEn: "Why there are no spaces",
    titleJa: "分かち書きをしない理由",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "before_first", subjectType: "SENTENCE" },
    body: `## Why there are no spaces

Japanese sentences are written with no spaces between words. English needs spaces because the alphabet alone doesn't mark word boundaries: "thecat" and "the cat" are visually identical until a space appears. Japanese doesn't have this problem.

Kanji are visually dense and stand out. Hiragana are smaller and flow between them. That mix creates a natural rhythm: kanji (meaning), hiragana (grammar), kanji (meaning), hiragana (grammar). A reader's eyes follow the pattern instantly, the same way you don't need spaces in EnglishWhenCapitalsDoThisWork.

So when you see a sentence like <ruby>私<rt>わたし</rt></ruby>は<ruby>毎<rt>まい</rt></ruby><ruby>日<rt>にち</rt></ruby><ruby>学<rt>がっ</rt></ruby><ruby>校<rt>こう</rt></ruby>に<ruby>行<rt>い</rt></ruby>きます, you're reading: <ruby>私<rt>わたし</rt></ruby> (I, kanji) は (topic marker, kana) <ruby>毎<rt>まい</rt></ruby><ruby>日<rt>にち</rt></ruby> (every day, kanji + kanji) <ruby>学<rt>がっ</rt></ruby><ruby>校<rt>こう</rt></ruby> (school, kanji + kanji) に (location marker, kana) <ruby>行<rt>い</rt></ruby>き (go, kanji + okurigana) ます (polite ending, all kana). The visual texture makes the boundaries clear. No spaces needed.`,
  },
  {
    slug: "okurigana",
    order: 10,
    titleEn: "Okurigana",
    titleJa: "送り仮名",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 3 },
    body: `## Okurigana

**Okurigana** (<ruby>送<rt>おく</rt></ruby>り<ruby>仮<rt>か</rt></ruby><ruby>名<rt>な</rt></ruby>, literally "trailing kana") are the hiragana you attach to a kanji to carry the inflection while the kanji stays fixed. Take <ruby>書<rt>か</rt></ruby> ("write"). By itself it's just the meaning-root. Add okurigana and you get a complete word:

- <ruby>書<rt>か</rt></ruby>く (かく, "to write," plain form)
- <ruby>書<rt>か</rt></ruby>き (かき, "writing," stem form)
- <ruby>書<rt>か</rt></ruby>け (かけ, "write!" imperative)
- <ruby>書<rt>か</rt></ruby>いた (かいた, "wrote," past tense)

The kanji <ruby>書<rt>か</rt></ruby> doesn't change. The different okurigana endings tell you tense, mood, whether it's part of a compound, and all the grammar that verbs and adjectives carry in Japanese. The same trick works with adjectives: <ruby>高<rt>たか</rt></ruby>い (たかい, "tall/expensive," using い), <ruby>高<rt>たか</rt></ruby>く (たかく, "tallness," using く), <ruby>高<rt>たか</rt></ruby>かった (たかかった, "was tall," using かった).

Okurigana aren't optional decoration: they're part of the word. Leaving them off changes meaning and breaks grammar just as much as spelling wrong in English does.`,
  },
  {
    slug: "verb-groups",
    order: 11,
    titleEn: "Verb groups",
    titleJa: "動詞の種類",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 5 },
    body: `## Verb groups

Japanese verbs fall into three groups based on how they conjugate. Knowing a verb's group tells you all its forms.

**Ichidan** (<ruby>一<rt>いち</rt></ruby><ruby>段<rt>だん</rt></ruby>, "one-step") verbs end in -る: <ruby>食<rt>た</rt></ruby>べる (たべる, "to eat"), <ruby>見<rt>み</rt></ruby>る (みる, "to see"), <ruby>寝<rt>ね</rt></ruby>る (ねる, "to sleep"). To conjugate them, drop the -る and add the ending. Past tense: <ruby>食<rt>た</rt></ruby>べた. Potential: <ruby>食<rt>た</rt></ruby>べられる.

**Godan** (<ruby>五<rt>ご</rt></ruby><ruby>段<rt>だん</rt></ruby>, "five-step") verbs end in any kana except -る (or specifically, -る consonants that aren't e): <ruby>飲<rt>の</rt></ruby>む (のむ, "to drink"), <ruby>書<rt>か</rt></ruby>く (かく, "to write"), <ruby>読<rt>よ</rt></ruby>む (よむ, "to read"). They conjugate by changing the final syllable according to which vowel it needs. Past tense: <ruby>飲<rt>の</rt></ruby>んだ, <ruby>書<rt>か</rt></ruby>いた, <ruby>読<rt>よ</rt></ruby>んだ.

**Irregular verbs** are the two that don't follow the rules: する ("to do") and <ruby>来<rt>く</rt></ruby>る ("to come"). You memorize these individually because no pattern covers them.

The pattern matters because once you know a verb's group, you can predict its entire conjugation paradigm without memorizing each form separately. It's why the vocabulary in this app notes the verb group: it's telling you which conjugation system to apply.`,
  },
  {
    slug: "politeness-levels",
    order: 12,
    titleEn: "Politeness levels",
    titleJa: "敬語のレベル",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 8 },
    body: `## Politeness levels

Japanese grammar changes based on social context: who you're talking to, whether you know them, your relative status. The same meaning can be expressed three different ways.

**Plain form** (casual, <ruby>敬<rt>けい</rt></ruby><ruby>語<rt>ご</rt></ruby>) is what you use with close friends, family, or people much younger than you. 何をしているの ("What are you doing?") No politeness marker.

**Polite form** (です/ます, <ruby>丁<rt>ていねい</rt></ruby>語) adds -ます or です to verbs and nouns. This is the default for talking to strangers, classmates, coworkers, or anyone you don't have a close relationship with. 何をしていますか ("What are you doing?") Polite but not subservient.

**Honorific/Keigo** (<ruby>敬<rt>けい</rt></ruby><ruby>語<rt>ご</rt></ruby>) is for talking about or to people of higher social status, customers, or in formal contexts. It involves prefix お- or ご-, special verb forms, and sometimes complete vocabulary changes. Rather than <ruby>食<rt>た</rt></ruby>べる (taberu, "to eat"), a verb in a deferential context becomes いただく (itadaku, literally "to humbly receive," used for eating when showing respect).

Most everyday learning happens in polite form: it's appropriate most of the time, mistakes in it are forgiving, and plain form comes naturally once you understand the core verb system. Honorific is context-specific: learn it when you need it.`,
  },
  {
    slug: "transitive-intransitive",
    order: 13,
    titleEn: "Transitive vs. intransitive verbs",
    titleJa: "他動詞と自動詞",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 12 },
    body: `## Transitive vs. intransitive verbs

Many Japanese verbs come in pairs: one **transitive** (<ruby>他<rt>た</rt></ruby><ruby>動<rt>どう</rt></ruby><ruby>詞<rt>し</rt></ruby>, who acts on something else) and one **intransitive** (<ruby>自<rt>じ</rt></ruby><ruby>動<rt>どう</rt></ruby><ruby>詞<rt>し</rt></ruby>, who undergoes an action themselves).

Take <ruby>開<rt>あ</rt></ruby>く ("to open by itself") vs. <ruby>開<rt>あ</rt></ruby>ける ("to open something"). "The door opens" (<ruby>自<rt>じ</rt></ruby><ruby>動<rt>どう</rt></ruby><ruby>詞<rt>し</rt></ruby>) uses <ruby>開<rt>あ</rt></ruby>く: ドアが<ruby>開<rt>ひら</rt></ruby>きました. "I open the door" (<ruby>他<rt>た</rt></ruby><ruby>動<rt>どう</rt></ruby><ruby>詞<rt>し</rt></ruby>) uses <ruby>開<rt>あ</rt></ruby>ける: <ruby>私<rt>わたし</rt></ruby>はドアを<ruby>開<rt>あ</rt></ruby>けました. Same kanji root <ruby>開<rt>かい</rt></ruby>, different okurigana, completely different grammar.

Another pair: <ruby>落<rt>お</rt></ruby>ちる ("to fall") vs. <ruby>落<rt>お</rt></ruby>とす ("to drop"). "The pen fell" (<ruby>自<rt>じ</rt></ruby><ruby>動<rt>どう</rt></ruby><ruby>詞<rt>し</rt></ruby>) is ペンが<ruby>落<rt>お</rt></ruby>ちました. "I dropped the pen" (<ruby>他<rt>た</rt></ruby><ruby>動<rt>どう</rt></ruby><ruby>詞<rt>し</rt></ruby>) is <ruby>私<rt>わたし</rt></ruby>はペンを<ruby>落<rt>お</rt></ruby>としました.

Why this matters: the particle that marks the thing being acted on is を (the direct object). If you see を, you know a transitive verb is acting on that thing. If you don't see を, expect an intransitive verb. The pairing is predictable enough that you can guess the other form if you know one, and once you see both forms used, the distinction becomes clear.`,
  },
  {
    slug: "counters",
    order: 14,
    titleEn: "Counters",
    titleJa: "助数詞",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "account_level", level: 15 },
    body: `## Counters

In English you say "three books," "three pens," "three people" the same way. In Japanese, the word for "three" changes depending on *what* you're counting because every category of object has its own counting suffix.

**-<ruby>冊<rt>さつ</rt></ruby>** counts flat things like books: <ruby>本<rt>ほん</rt></ruby>を<ruby>三<rt>さん</rt></ruby><ruby>冊<rt>さつ</rt></ruby> (three books).

**-<ruby>本<rt>ほん</rt></ruby>** counts long, thin things like pens or pencils: ペンを<ruby>五<rt>ご</rt></ruby><ruby>本<rt>ほん</rt></ruby> (five pens).

**-<ruby>人<rt>にん</rt></ruby>** counts people: <ruby>学<rt>がく</rt></ruby><ruby>生<rt>せい</rt></ruby>が<ruby>十<rt>じゅう</rt></ruby><ruby>人<rt>にん</rt></ruby> (ten students).

**-<ruby>匹<rt>ひき</rt></ruby>** counts small animals: <ruby>猫<rt>ねこ</rt></ruby>が<ruby>二<rt>に</rt></ruby><ruby>匹<rt>ひき</rt></ruby> (two cats).

**-<ruby>個<rt>こ</rt></ruby>** is a general-purpose counter for small objects that don't fit another category: りんごを<ruby>六<rt>ろく</rt></ruby><ruby>個<rt>こ</rt></ruby> (six apples).

There are dozens of these because Japanese is precise about object categories. The pattern is predictable once you memorize the major ones: the counter goes after the number and before or after the noun depending on the context.

Counters aren't optional: saying <ruby>本<rt>ほん</rt></ruby>を<ruby>三<rt>みっ</rt></ruby>つ (using the generic counter) instead of <ruby>三<rt>さん</rt></ruby><ruby>冊<rt>さつ</rt></ruby> is wrong or sounds childish depending on context. This app's vocabulary will flag which counter applies to each item.`,
  },
  {
    slug: "what-is-guru",
    order: 15,
    titleEn: "What is Guru?",
    titleJa: "グルとは？",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "first_guru" },
    body: `## What is Guru?

**Guru** (ステージ5) is where this app unlocks new content based on what you've learned. It's not a perfect mastery milestone, but it's the threshold where the app decides you know something well enough to build on it.

Guru comes in two flavors: Guru I (stage 5, 7-day interval) and Guru II (stage 6, 14-day interval). Both are treated as Guru for unlocking purposes.

Here's what getting items to Guru unlocks:

- **10 radicals at Guru** unlocks <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> lessons. You won't see <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> until you've solidified 10 radicals.
- **10 <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> at Guru** unlocks <ruby>語<rt>ご</rt></ruby><ruby>彙<rt>い</rt></ruby> lessons.
- **50 vocabulary at Guru** unlocks both grammar and sentences.

These gates exist because vocabulary *needs* its <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> roots, and <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> *needs* its radicals: learning them out of order wastes effort because you're trying to memorize isolated shapes instead of recognizing patterns you've already built. The Guru gate ensures the prerequisites are solid before you move forward.

Between Guru I and Guru II, items start spending two weeks between reviews instead of one. It's not because you've forgotten more: it's because memory for well-learned material is more stable, so you need less frequent reinforcement. This is where the spaced repetition really starts to space.`,
  },
  {
    slug: "srs-ladder",
    order: 16,
    titleEn: "The full SRS ladder",
    titleJa: "SRSの段階",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "first_burn" },
    body: `## The full SRS ladder

Every item you learn climbs a ten-stage ladder. Congratulations on burning your first: here's how the full climb works.

**Stage 0: Lesson.** You've just unlocked the item. Answer it correctly once to move to Apprentice I.

**Apprentice I-IV** (stages 1-4): You're still building confidence. Intervals are short (4 hours, 8 hours, 1 day, 2 days). Get it wrong and you drop back. The apprentice stages are where most learning happens.

**Guru I-II** (stages 5-6): You've proven short-term retention. Intervals grow (7 days, then 14 days). This is where the item unlocks the next tier of content: 10 radicals here unlocks <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby>, 10 <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> unlocks vocab, 50 vocab unlocks sentences and grammar.

**Master** (stage 7, 30 days): Long-term retention confirmed.

**Enlightened** (stage 8, 120 days): Even longer term.

**Burned** (stage 9): Proof of permanent retention. It drops out of review entirely and never comes back. Wrong answers on Burned items would drop the stage, but a Burned item should only see correct answers because you know it cold.

A perfect run from Lesson to Burned takes a minimum of about 175 days of consistent daily review, assuming no mistakes. Most items take longer because wrong answers reset your progress. But that's the point: the system brings back what you're weak on and spaces out what you know, so effort concentrates where it matters.

Note that mastery is separate: it only increases, even if your SRS stage drops. Mastery tracks your overall confidence in an item independent of review scheduling.`,
  },
  {
    slug: "jlpt-explained",
    order: 17,
    titleEn: "What is the JLPT?",
    titleJa: "JLPTとは？",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "manual" },
    body: `## What is the JLPT?

The **JLPT** (Japanese Language Proficiency Test, <ruby>日<rt>に</rt></ruby><ruby>本<rt>ほん</rt></ruby><ruby>語<rt>ご</rt></ruby><ruby>能<rt>のう</rt></ruby><ruby>力<rt>りょく</rt></ruby><ruby>試<rt>し</rt></ruby><ruby>験<rt>けん</rt></ruby>) is a standardized proficiency exam administered twice yearly in Japan and internationally. It's one of the most widely recognized credentials for Japanese ability.

The JLPT has five levels, labeled N5 through N1:

- **N5:** Beginner. About 100 <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> and 800 vocabulary words.
- **N4:** Elementary. About 300 <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> and 1500 vocabulary words.
- **N3:** Intermediate. More complex grammar and nuanced meaning.
- **N2:** Upper intermediate. Nearly fluent reading and listening.
- **N1:** Advanced. Reads complex texts, understands nuanced speech, grasps cultural context.

This app cross-references its <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> and vocabulary against the JLPT levels for your reference, so you can see which exam tier each item relates to. But Nihongo Quest's own curriculum ladder is independent: the app's level 1 doesn't map to N5, and you won't be "ready for the N3" once you hit a certain app level. The JLPT is just a reference point for what words exist at what difficulty in real Japanese; the app's order of introduction is driven by radical dependency and spaced repetition.`,
  },
  {
    slug: "furigana-explained",
    order: 18,
    titleEn: "Furigana explained",
    titleJa: "ふりがなとは？",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "manual" },
    body: `## Furigana explained

**Furigana** (ふりがな) are small kana characters printed above (or to the right of, in vertical text) a kanji to show how it's pronounced. They're a reading aid, most commonly used in children's books, textbooks, or whenever a kanji might be unfamiliar.

Example: 生 can be read う, い, or せい depending on context. In a sentence where it means "to be born" (<ruby>生<rt>う</rt></ruby>まれる), the reading うま would appear above it in small text so a learner doesn't have to guess.

This app includes furigana on every <ruby>漢<rt>かん</rt></ruby><ruby>字<rt>じ</rt></ruby> in its curriculum, in sentences, and in vocabulary breakdowns. It shows them automatically so you can see the reading immediately instead of having to look it up. Once you've learned the reading well enough that you don't need to see it, furigana becomes visual noise: real Japanese texts (novels, news, etc.) mostly skip furigana on common words and reserve them for unfamiliar or ambiguous readings.

Think of furigana as training wheels: they're there when you need them, and you'll stop noticing them once the reading sinks in.`,
  },
  // --------------------------------------------------- App mechanics (3)
  // Unlike every tutorial above, these describe this app's own interface and
  // rules rather than the Japanese language. They exist because each covers
  // behaviour that is genuinely counterintuitive from the UI alone — see the
  // "Not covered: app mechanics" section in docs/roadmap.md.
  {
    slug: "mastery-vs-srs-stage",
    order: 19,
    titleEn: "Mastery vs. SRS stage",
    titleJa: "熟練度とSRSステージ",
    required: false,
    estimatedMinutes: 3,
    trigger: { kind: "first_guru" },
    body: `## Mastery vs. SRS stage

This app tracks two different numbers for every item you learn, and they behave in opposite ways. Confusing them is the single most common misreading of your own progress.

**SRS stage** is *when you'll see the item next*. It runs from Lesson (stage 0) up through Apprentice, Guru, Master, Enlightened, to Burned (stage 9). Answer correctly and it climbs one step, and the gap until the next review grows: 4 hours, 8 hours, a day, two days, a week, and onward. Answer incorrectly and **it drops**. Stage is a scheduling position, not a score, and it is designed to fall so that a shaky item comes back sooner.

**Mastery** is *how much correct work you have put into the item, ever*. Every correct answer adds mastery XP, worth more at higher stages. Mastery **never decreases**. Miss an item ten times in a row and your mastery on it is unchanged by those misses — you simply stop adding to it until you start answering correctly again.

So a single miss on an Enlightened item is both a real setback and no setback at all, depending on which number you look at. The stage falls back to Master or Guru II and you will see that item much sooner. The mastery you built stays exactly where it was.

### Why two numbers

If there were only stage, then every mistake would erase evidence of work you genuinely did, and a long-known item that you slipped on once would look identical to something you had never learned. If there were only mastery, nothing would ever reschedule and the whole point of spaced repetition would be lost.

Stage answers "what should I study now?" Mastery answers "how far have I actually come?" You want both, and you want them to disagree sometimes.

### The part that surprises people

Mastery quietly protects you. When a well-learned item is missed, the app checks how cleanly you climbed to your current stage. Normally a miss at Guru or above costs you **two** stages, because losing long-term status should hurt. But if your history on that item is clean, the penalty is reduced to **one** stage instead.

At Enlightened that is the difference between falling to Master and falling to Guru II — roughly 120 days of scheduling versus 14. The item you have never fumbled is treated more gently than the item that has been bouncing up and down for a dozen reviews, even though both just got the same question wrong.

Note that this is measured as a *ratio* against a clean climb, not as raw mastery XP. Raw mastery rises with volume, and a struggling item accumulates more of it precisely because it keeps coming back. A shaky item at Guru I can be holding three times the mastery XP of a flawless one. Comparing against what a perfect climb would have earned is what turns that into a meaningful signal instead of a reward for failure.

### Reading your own numbers

- Stage dropped, mastery unchanged: normal. You missed something; the schedule adjusted. Nothing was lost.
- Mastery climbing, stage stuck: you are answering correctly but hitting the 4-hour promotion cap, which blocks upward movement without blocking the review itself.
- Both flat: you are not reviewing that item, ranked.

Unranked practice is worth calling out here: it never changes stage and never awards mastery. It is drilling, not progress, by design.`,
  },
  {
    slug: "kana-skip-flow",
    order: 20,
    titleEn: "Skipping kana",
    titleJa: "かなをスキップする",
    required: false,
    estimatedMinutes: 2,
    trigger: { kind: "manual" },
    body: `## Skipping kana

If you already read hiragana and katakana, you do not have to sit through 208 kana lessons. Settings has a **skip kana** option that marks every kana as known in one action.

What it actually does: it burns every kana subject outright, setting each to the final stage so none of them will ever appear in a review queue. It is taken at your word — there is no test. There is also an unskip, which removes those entries again, but only for kana you have not since reviewed normally.

### The part that surprises people

**Skipping kana does not get you to kanji any faster.**

It is natural to assume that clearing 208 items off the front of the curriculum must accelerate everything behind it. It does not, because kana is not what stands between you and kanji. The ladder is gated like this:

- **Kana** gates **radicals**. Every kana must be passed or skipped before any radical unlocks. This is a one-time gate on the whole rest of the curriculum.
- **Radicals** gate **kanji**. A kanji unlocks when every radical it is built from reaches Guru.
- **Kanji** gate **vocabulary**, and vocabulary gates sentences and grammar.

Kanji sits behind *radicals*, and radicals have to be learned and brought to Guru the ordinary way regardless of what you did with kana. Skipping saves you the kana reviews themselves — which is a real saving, and the reason the feature exists — but it does not shorten the radical climb, and the radical climb is what actually stands in front of kanji.

There is a second soft gate worth knowing: kanji as a *type* does not appear in lesson batches until you have 10 radicals at Guru. Vocabulary needs 10 kanji at Guru. Sentences and grammar each need 50 vocabulary at Guru. Locked types stay visible and browsable the whole time; they just do not get served to you in lessons yet.

### So should you skip?

Skip if you genuinely read both syllabaries — you will save yourself a large number of reviews that teach you nothing.

Do not skip to reach kanji sooner. That is not what it does, and starting the radical climb without solid kana makes every reading question harder than it needs to be.`,
  },
  {
    slug: "lessons-and-reviews",
    order: 21,
    titleEn: "Lessons, reviews, and practice",
    titleJa: "レッスンと復習",
    required: false,
    estimatedMinutes: 3,
    trigger: { kind: "manual" },
    body: `## Lessons, reviews, and practice

Three places in this app serve you items, and they do very different things to your progress.

### Lessons

Lessons introduce material you have never seen. An item appears in a lesson batch once everything it is built from has reached Guru and its curriculum level is at or below your current level for that type. Finishing a lesson puts the item at stage 0 and schedules its first review.

You can start lessons per subject type, so you are not forced to take radicals, kanji, and vocabulary in one undifferentiated pile.

### Reviews (ranked)

This is the SRS proper, and the only mode that moves your progress. The queue is filtered to items that are actually **due**, which means a session is finite: clear what is due and you are done. When nothing is due, the page tells you how long until the next item comes up.

Ranked reviews are the only place that:

- moves an item's SRS stage, up or down
- awards mastery
- awards LP, which drives your rank

XP is 8 + 3 per stage for a correct answer, 2 for an incorrect one, with your streak multiplier applied on top.

### Practice (unranked)

Practice lets you drill any unlocked types and levels you like, ignoring due dates entirely. It is deliberately inert: it **cannot promote or demote anything**. Stage, due date, and mastery are all untouched. It awards no LP and gives 1 XP per correct answer, hard-capped at 150 per day.

Your answers are still recorded, and per-item correct and incorrect counters still update, so practice shows up honestly in your accuracy statistics. It just does not move you up the ladder.

The split exists because an unfiltered queue does not scale. Once you have a few hundred items started, a queue with no due-date filter serves your entire collection every session and can never be emptied. Making that mode free of stage changes and rank rewards is what keeps it from being both exhausting and exploitable.

### Answering

Meaning questions expect English. Reading questions expect Japanese, typed in kana. Press Enter to submit, then Enter again to advance to the next item. Radicals only ever ask for meaning, since they are building blocks rather than words with pronunciations of their own.

If an answer of yours was reasonable but marked wrong, you can add it to that item's accepted meanings so it counts next time. If a mnemonic is not working for you, edit it — hand-edited mnemonics are marked as yours and are never overwritten by a regeneration pass.

### One rule that catches people out

A correct answer within **4 hours** of that item's last promotion will not promote it again. The review still counts and the item still reschedules, but the stage does not move, and XP for it is cut to 10%. Spacing is the mechanism doing the work here; answering the same item repeatedly in one sitting cannot substitute for time passing.`,
  },
];

# Text Readings (読解)

**Status: deliberately not built.** The `READING` SubjectType exists in the
enum with zero rows, and the UI renders it as a `準備中 / Coming soon`
placeholder. That is the intended state, not an oversight.

## Why not Aozora Bunko

Aozora was investigated and rejected on **content difficulty**, not on
licensing or tooling. Both of those are fine:

- Public domain, no license problem.
- Texts ship with real ruby markup: `<ruby><rb>下人</rb><rp>（</rp><rt>げにん</rt><rp>）</rp></ruby>`.
  Furigana would be a parsing job, not the alignment problem that
  JmdictFurigana solves for vocabulary.
- `https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip`
  is a master index of every work with per-work download URLs.

The problem is what the texts contain. Akutagawa's 羅生門, one of the most
approachable works in the archive, opens with 検非違使, 揉烏帽子, 市女笠,
朱雀大路: Heian-period vocabulary that a learner will not meet again. The
archive is Meiji and Taisho era throughout, so expect classical grammar,
archaic auxiliaries, and historical kana orthography.

Seeding it would produce a content type full of material that cannot be read
for years, which is worse than an honest empty state.

## Gotchas if this is ever revisited

- Files are **Shift-JIS**, not UTF-8. Transcode on read.
- Some characters are outside Unicode and appear as `<img class="gaiji">`
  tags with a `※(...)` alt attribute. Any parser must handle them rather
  than dropping them silently.
- Ruby uses `<rp>` fallback parens that must be stripped, not rendered.

## The alternative, when it is worth doing

Hand-written graded passages: 4 to 8 sentences each, deliberately reusing
vocabulary the learner already has at that level. Furigana composes for free
from the existing per-word segment data, the same way sentence furigana
already works.

This is real authoring work, so it is worth doing only once the sentence
corpus is no longer sufficient practice. With 7,705 seeded sentences, that is
some way off.

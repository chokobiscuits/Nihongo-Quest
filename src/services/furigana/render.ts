/// One JmdictFurigana segment: `ruby` is the base text, `rt` is its reading
/// annotation (absent when that segment has no kanji, e.g. okurigana).
export interface FuriganaSegment {
  ruby: string;
  rt?: string;
}

/// A segment ready for a <ruby> render: `rt` is always present in the output
/// (empty string when there is nothing to annotate), so the UI can map
/// straight to <ruby>{ruby}<rt>{rt}</rt></ruby> without conditionals.
export interface RenderedRubySegment {
  ruby: string;
  rt: string;
}

export type FuriganaRender =
  | { mode: "hidden"; text: string }
  | { mode: "segments"; segments: RenderedRubySegment[] };

/// Turns a JmdictFurigana-shaped segment array into a render-ready structure.
///
/// - `showFurigana: false` collapses everything to plain text (no <rt>), for
///   users who've turned readings off.
/// - `segments` with no entries, or a single segment with no `rt`, mean the
///   source has no per-character breakdown; the caller marks this on the
///   Subject as `furiganaFallback`, and this function still renders whatever
///   ruby/rt pairs it was given.
export function renderFurigana(
  segments: FuriganaSegment[],
  showFurigana: boolean,
): FuriganaRender {
  if (!showFurigana) {
    return { mode: "hidden", text: segments.map((s) => s.ruby).join("") };
  }

  return {
    mode: "segments",
    segments: segments.map((s) => ({ ruby: s.ruby, rt: s.rt ?? "" })),
  };
}

/// Builds a single whole-word fallback segment for a Subject that has
/// `furiganaFallback: true` — i.e. no per-character JmdictFurigana entry, so
/// the whole word gets one ruby span over one reading.
export function wholeWordFallback(characters: string, reading: string): FuriganaSegment[] {
  return [{ ruby: characters, rt: reading }];
}

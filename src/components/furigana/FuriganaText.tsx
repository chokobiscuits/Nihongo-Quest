import type { FuriganaRender } from "@/services/furigana/render";
import { cn } from "@/lib/utils";

export interface FuriganaTextProps {
  render: FuriganaRender;
  /// Marks the source as a whole-word fallback (no per-character JmdictFurigana
  /// entry) so the wider `rt` letter-spacing kicks in.
  fallback?: boolean;
  className?: string;
}

/// Renders a `FuriganaRender` union directly. `hidden` mode is plain text
/// (readings toggled off); `segments` mode renders one <ruby> per segment,
/// each wrapped in <span lang="ja"> because Safari's ruby positioning needs
/// the language tag on the element to lay out correctly.
export function FuriganaText({ render, fallback = false, className }: FuriganaTextProps) {
  if (render.mode === "hidden") {
    return (
      <span lang="ja" className={cn("has-furigana", className)}>
        {render.text}
      </span>
    );
  }

  return (
    <span
      lang="ja"
      className={cn("has-furigana", fallback && "ruby-fallback", className)}
    >
      {render.segments.map((segment, index) => (
        <span lang="ja" key={`${segment.ruby}-${index}`}>
          <ruby>
            {segment.ruby}
            <rt>{segment.rt}</rt>
          </ruby>
        </span>
      ))}
    </span>
  );
}

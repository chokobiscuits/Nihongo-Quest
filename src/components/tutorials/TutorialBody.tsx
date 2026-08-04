import { renderTutorialBody } from "@/services/tutorials/render";

export interface TutorialBodyProps {
  markdown: string;
  className?: string;
}

/// Renders a tutorial's markdown body as sanitized HTML. `lang="ja"` on the
/// wrapper applies the app's Japanese prose line-height/letter-spacing (see
/// globals.css's [lang="ja"] rule) to embedded furigana/example text, while
/// English portions of the body still read fine under the same rule (it's a
/// line-height tweak, not a font swap).
export function TutorialBody({ markdown, className }: TutorialBodyProps) {
  const html = renderTutorialBody(markdown);
  return (
    <div
      lang="ja"
      className={
        "prose-tutorial flex flex-col gap-3 text-body text-text-dim [&_h1]:text-h2 [&_h1]:font-semibold [&_h1]:text-text [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:text-text [&_h3]:font-semibold [&_h3]:text-text [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-text [&_code]:rounded-[var(--radius-chip)] [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-caption [&_a]:text-brand-text [&_a]:underline" +
        (className ? ` ${className}` : "")
      }
      // Sanitized in renderTutorialBody, see that function's doc comment.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

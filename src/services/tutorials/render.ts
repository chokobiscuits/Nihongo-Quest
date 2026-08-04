import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

/// Strips the handful of HTML constructs that could execute script from
/// authored markdown output: <script>/<style> tags, on* event handler
/// attributes, and javascript: URLs. Tutorial bodies are trusted-ish
/// (authored by the app's own user, not arbitrary third-party input — same
/// trust level as Subject's mnemonic/hint fields) but still run through this
/// pass so a stray paste of a <script> tag can never execute.
function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1="#"');
}

/// Renders a tutorial's markdown body to sanitized HTML for
/// dangerouslySetInnerHTML. Furigana examples use plain <ruby>/<rt> tags,
/// which markdown passes through untouched (marked leaves inline HTML
/// alone) — see globals.css's ruby/rt rules and the [lang="ja"] block for
/// how those render.
export function renderTutorialBody(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return stripUnsafeHtml(html);
}

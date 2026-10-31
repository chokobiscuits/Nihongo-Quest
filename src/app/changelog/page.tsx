import { Panel } from "@/components/panel/Panel";
import { CHANGELOG } from "@/content/changelog";

export const metadata = { title: "What's new | Nihongo Quest" };

/// Every release note, newest first. The data lives in src/content/
/// changelog.ts; this page only renders it, and is static.
export default function ChangelogPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">What&apos;s new</span> <span lang="ja" className="text-text-muted">更新情報</span>
      </h1>

      {CHANGELOG.map((release, index) => (
        <Panel
          key={release.id}
          accent="var(--color-brand)"
          title={release.title}
        >
          <div className="flex flex-col gap-3">
            <span className="text-micro text-text-faint" lang="en">
              {index === 0 ? `Latest · ${release.date}` : release.date}
            </span>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-text-muted">
              {release.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
            {release.details && <p className="text-caption text-text-dim">{release.details}</p>}
          </div>
        </Panel>
      ))}
    </div>
  );
}

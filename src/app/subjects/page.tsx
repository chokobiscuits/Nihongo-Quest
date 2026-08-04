import Link from "next/link";
import { getSubjectTypeSummaries } from "@/server/queries/subjects";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { typeToSlug } from "@/components/subject/typeSlug";

export default async function SubjectsPage() {
  const summaries = await getSubjectTypeSummaries();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Subjects</span> <span lang="ja" className="text-text-muted">科目</span>
      </h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((summary) => (
          <SubjectTypeCard key={summary.type} summary={summary} />
        ))}
      </div>
    </div>
  );
}

function SubjectTypeCard({ summary }: { summary: Awaited<ReturnType<typeof getSubjectTypeSummaries>>[number] }) {
  const theme = SUBJECT_THEME[summary.type];
  const slug = typeToSlug(summary.type);

  if (!summary.seeded) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-5 min-h-[176px]"
        style={{ "--accent": theme.base } as React.CSSProperties}
      >
        <span className="text-glyph-sm opacity-30" aria-hidden style={{ color: theme.base }}>
          {theme.icon}
        </span>
        <span lang="ja" className="text-caption text-text-faint">
          準備中
        </span>
        <span className="text-micro text-text-faint" lang="en">
          Coming soon
        </span>
      </div>
    );
  }

  const percent = summary.total > 0 ? Math.round((summary.learned / summary.total) * 100) : 0;
  const locked = summary.seeded && !summary.unlocked;

  return (
    <Link
      href={`/subjects/${slug}`}
      className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors duration-[var(--duration-fast)] hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      title={locked ? summary.requirement ?? undefined : undefined}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-h2"
          style={{ background: "color-mix(in oklch, " + theme.base + " 18%, transparent)", color: theme.base, opacity: locked ? 0.5 : 1 }}
          aria-hidden
        >
          {locked ? "🔒" : theme.icon}
        </span>
        {!locked && (
          <span className="text-caption font-semibold tabular-nums text-text" lang="en">
            {percent}%
          </span>
        )}
      </div>

      <div className="flex flex-col leading-tight">
        <span className="text-h3 font-semibold text-text" lang="en">
          {theme.labelEn}
        </span>
        <span lang="ja" className="text-caption text-text-faint">
          {theme.labelJa}
        </span>
      </div>

      {locked ? (
        <div className="flex flex-col gap-1.5">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full opacity-50"
              style={{
                width: `${Math.max(Math.round((summary.have / Math.max(summary.need, 1)) * 100), summary.have > 0 ? 0 : 1.5)}%`,
                background: theme.base,
              }}
            />
          </div>
          <span className="text-micro text-text-dim" lang="en">
            {summary.requirement}, {summary.have} of {summary.need}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(percent, percent > 0 ? 0 : 1.5)}%`, background: theme.base }}
            />
          </div>
          <span className="text-micro text-text-dim" lang="en">
            {summary.learned.toLocaleString()} / {summary.total.toLocaleString()} learned
          </span>
        </div>
      )}
    </Link>
  );
}

import Link from "next/link";
import { getTutorialLibrary } from "@/server/queries/tutorials";
import { Panel } from "@/components/panel/Panel";
import { TutorialIcon } from "@/components/shell/NavIcons";
import { MarkAllReadButton } from "@/components/tutorials/MarkReadButton";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

/// Full tutorial library — every tutorial, readable anytime regardless of
/// trigger, in `order` with its completed state.
export default async function TutorialsPage() {
  const tutorials = await getTutorialLibrary(APP_USER_ID);
  const completedCount = tutorials.filter((t) => t.completed).length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Tutorials</span> <span lang="ja" className="text-text-muted">チュートリアル</span>
      </h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-text-dim" lang="en">
          {completedCount} of {tutorials.length} completed
        </p>
        <MarkAllReadButton remaining={tutorials.length - completedCount} />
      </div>

      <Panel accent="var(--color-brand)" icon={<TutorialIcon />} title="All tutorials" titleJa="一覧">
        <div className="flex flex-col divide-y divide-line">
          {tutorials.map((t) => (
            <Link
              key={t.id}
              href={`/tutorials/${t.slug}`}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-text"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-body font-medium text-text" lang="en">
                  {t.titleEn}
                </span>
                <span className="truncate text-caption text-text-faint" lang="ja">
                  {t.titleJa}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.required && (
                  <span className="rounded-[var(--radius-chip)] bg-surface-3 px-2 py-0.5 text-micro text-text-dim">
                    Required
                  </span>
                )}
                <span
                  className="rounded-[var(--radius-chip)] px-2 py-0.5 text-micro"
                  style={
                    t.completed
                      ? { background: "var(--color-success)", color: "var(--color-canvas)" }
                      : { background: "var(--color-surface-2)", color: "var(--color-text-faint)" }
                  }
                >
                  {t.completed ? "Completed" : "Not completed"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

import Link from "next/link";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { SubjectBrowseTile } from "@/components/subject/SubjectBrowseTile";
import { KanaSkipControl } from "@/components/kana/KanaSkipControl";
import { getKanaBrowseGroups } from "@/server/queries/subjects";
import { isKanaResolvedFor } from "@/services/srs/kana-gate";
import { SubjectType } from "@/generated/prisma/enums";

import { APP_USER_ID } from "@/lib/appUser";

const SCRIPT_LABEL: Record<"hiragana" | "katakana", { en: string; ja: string }> = {
  hiragana: { en: "Hiragana", ja: "ひらがな" },
  katakana: { en: "Katakana", ja: "カタカナ" },
};

/// Kana browse page, grouped by script (hiragana before katakana) then by
/// gojuon row rather than an opaque level number, unlike every other
/// subject type's level-based /subjects/[type] browse. One script renders
/// at a time, selected by ?script=, so the page ships ~half the tiles.
export default async function KanaPage({
  searchParams,
}: {
  searchParams: Promise<{ script?: string }>;
}) {
  const theme = SUBJECT_THEME[SubjectType.KANA];
  const { script } = await searchParams;
  const [groups, resolved] = await Promise.all([
    getKanaBrowseGroups(APP_USER_ID),
    isKanaResolvedFor(APP_USER_ID),
  ]);
  const activeScript =
    script === "katakana" || script === "hiragana" ? script : (groups[0]?.script ?? "hiragana");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-h1 font-semibold text-text">
          <span lang="en">{theme.labelEn}</span> <span lang="ja" className="text-text-muted">{theme.labelJa}</span>
        </h1>
        <KanaSkipControl initialResolved={resolved} />
      </div>

      <p className="text-caption text-text-dim" lang="en">
        Already know your kana? Skip ahead. Radicals unlock once every kana here is passed or skipped.
      </p>

      {/* One script at a time. Rendering all 208 tiles at once put this page
          at 540KB, the same problem that made /subjects/vocabulary 1.8MB. */}
      <nav className="flex gap-2" aria-label="Script">
        {groups.map((group) => {
          const active = group.script === activeScript;
          return (
            <Link
              key={group.script}
              href={`/subjects/kana?script=${group.script}`}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-[var(--radius-chip)] border px-3 h-8 flex items-center text-caption font-medium transition-colors duration-[var(--duration-fast)] " +
                (active
                  ? "border-line-strong bg-surface-3 text-text"
                  : "border-line bg-surface text-text-dim hover:text-text")
              }
            >
              <span lang="en">{SCRIPT_LABEL[group.script].en}</span>
              <span lang="ja" className="ml-1.5 text-text-faint">
                {SCRIPT_LABEL[group.script].ja}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-6">
        {groups
          .filter((g) => g.script === activeScript)
          .map((group) => (
          <section key={group.script} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              {group.rows.map((row) => (
                <div key={row.row} className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
                  <span className="mb-2 block text-micro uppercase tracking-wide text-text-faint" lang="en">
                    {row.row} row
                  </span>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                    {row.items.map((item) => (
                      <SubjectBrowseTile key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

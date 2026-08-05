import Link from "next/link";
import { notFound } from "next/navigation";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { slugToType } from "@/components/subject/typeSlug";
import { SubjectLevelGroup } from "@/components/subject/SubjectLevelGroup";
import { SubjectFilterBar } from "@/components/subject/SubjectFilterBar";
import {
  getSubjectsForLevel,
  getSubjectLevelIndex,
  getJlptOptions,
  type BrowseFilters,
} from "@/server/queries/subjects";
import { getCurriculumLevels, getTypeUnlockStatuses } from "@/server/queries/curriculum";

import { APP_USER_ID } from "@/lib/appUser";

// Levels rendered per page load, windowed around the user's current level
// (or page 1 of the ladder) so a full 60-level browse never fires 60
// parallel per-level queries at once.
const LEVELS_PER_PAGE = 10;

// No generateStaticParams here: this segment has a dynamic [slug] child
// (the detail page) and its own content depends on searchParams (filters,
// pagination) and the live user level, so static generation buys nothing
// and empirically confuses the [slug] child's param resolution in dev.

export default async function SubjectTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ q?: string; state?: string; jlpt?: string; page?: string; level?: string }>;
}) {
  const { type: typeSlug } = await params;
  const subjectType = slugToType(typeSlug);
  if (!subjectType) notFound();

  const query = await searchParams;
  const theme = SUBJECT_THEME[subjectType];

  const [curriculumLevels, unlockStatuses, levelIndex, jlptOptions] = await Promise.all([
    getCurriculumLevels(APP_USER_ID),
    getTypeUnlockStatuses(APP_USER_ID),
    getSubjectLevelIndex(subjectType),
    getJlptOptions(subjectType),
  ]);
  const typeLevel = curriculumLevels[subjectType];
  const gated = subjectType === "KANJI" || subjectType === "VOCAB" || subjectType === "SENTENCE" || subjectType === "GRAMMAR" || subjectType === "READING";
  const unlockStatus = gated ? unlockStatuses[subjectType as "KANJI" | "VOCAB" | "SENTENCE" | "GRAMMAR" | "READING"] : null;
  const isLocked = Boolean(unlockStatus && !unlockStatus.unlocked);

  if (levelIndex.levels.length === 0 && !levelIndex.hasAdditional) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader labelEn={theme.labelEn} labelJa={theme.labelJa} />
        <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-10">
          <span className="text-glyph-sm opacity-30" aria-hidden style={{ color: theme.base }}>
            {theme.icon}
          </span>
          <span lang="ja" className="text-caption text-text-faint">
            準備中
          </span>
          <span className="text-micro text-text-faint" lang="en">
            Coming soon, no content seeded yet
          </span>
        </div>
      </div>
    );
  }

  const filters: BrowseFilters = {
    state: (query.state as BrowseFilters["state"]) ?? "all",
    jlpt: query.jlpt ? Number(query.jlpt) : undefined,
    search: query.q,
  };

  const isFiltering = Boolean(filters.search || (filters.state && filters.state !== "all") || filters.jlpt);

  // Paging window: default to the page containing the user's current level.
  const page = Number(query.page ?? "0");
  const allLevels = levelIndex.levels;
  const userLevelIndex = Math.max(0, allLevels.findIndex((l) => l >= typeLevel));
  const defaultPage = Math.floor((userLevelIndex === -1 ? 0 : userLevelIndex) / LEVELS_PER_PAGE);
  const activePage = query.page !== undefined ? page : defaultPage;

  // When filtering/searching, widen to all levels (still one query per
  // level, but bounded by however many levels this type actually has —
  // radicals top out well under 60, kanji/vocab go the full range but the
  // per-level query only selects matching rows).
  const windowLevels = isFiltering
    ? allLevels
    : allLevels.slice(activePage * LEVELS_PER_PAGE, (activePage + 1) * LEVELS_PER_PAGE);

  const includeAdditional = levelIndex.hasAdditional && (isFiltering || activePage === Math.ceil(allLevels.length / LEVELS_PER_PAGE) - 1 || allLevels.length === 0);

  const windowKeys: (number | null)[] = [...windowLevels, ...(includeAdditional ? [null] : [])];

  // Exactly one level is expanded at a time and only that level's rows are
  // fetched and rendered. Shipping every level in the window (collapsed or
  // not) put /subjects/vocabulary at 1.8MB of HTML.
  const keyOf = (l: number | null) => (l === null ? "additional" : String(l));
  const requestedOpen = query.level;
  const defaultOpenKey = windowLevels.includes(typeLevel)
    ? String(typeLevel)
    : keyOf(windowKeys[0] ?? null);
  const openKey = requestedOpen ?? defaultOpenKey;

  // Filtering searches across the whole window, so every matching level is
  // shown expanded; the result set is already narrowed by the filter.
  const openKeys = isFiltering ? windowKeys.map(keyOf) : [openKey];

  const fetched = await Promise.all(
    windowKeys
      .filter((l) => openKeys.includes(keyOf(l)))
      .map(async (level) => ({
        key: keyOf(level),
        items: await getSubjectsForLevel(subjectType, level, filters, APP_USER_ID),
      })),
  );
  const itemsByKey = new Map(fetched.map((f) => [f.key, f.items]));

  const groups = windowKeys.map((level) => {
    const key = keyOf(level);
    return {
      level,
      key,
      open: openKeys.includes(key),
      items: itemsByKey.get(key) ?? [],
      count: itemsByKey.get(key)?.length ?? levelIndex.counts[key] ?? 0,
    };
  });

  const nonEmptyGroups = isFiltering ? groups.filter((g) => g.items.length > 0) : groups;

  const baseParams = new URLSearchParams();
  if (query.q) baseParams.set("q", query.q);
  if (query.state) baseParams.set("state", query.state);
  if (query.jlpt) baseParams.set("jlpt", query.jlpt);
  if (query.page !== undefined) baseParams.set("page", String(activePage));
  const toggleHrefFor = (key: string, open: boolean) => {
    const p = new URLSearchParams(baseParams);
    if (!open) p.set("level", key);
    const qs = p.toString();
    return `/subjects/${typeSlug}${qs ? `?${qs}` : ""}`;
  };

  const totalPages = Math.max(1, Math.ceil(allLevels.length / LEVELS_PER_PAGE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader labelEn={theme.labelEn} labelJa={theme.labelJa} />
        {/* The browse page is where "I want to learn more of this" happens,
            so it needs its own way into a filtered lesson. Suppressed when
            locked: the banner below already explains why there is nothing
            to learn yet. */}
        {!isLocked && (
          <Link
            href={`/lessons?type=${typeSlug}`}
            className="inline-flex h-9 shrink-0 items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          >
            Start lessons
          </Link>
        )}
      </div>

      {isLocked && unlockStatus && (
        <div
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed p-4"
          style={{ borderColor: theme.base }}
        >
          <span className="text-h3" aria-hidden>🔒</span>
          <div className="flex flex-col leading-tight">
            <span className="text-sub font-medium text-text" lang="en">
              Locked — {unlockStatus.requirement}
            </span>
            <span className="text-micro text-text-faint" lang="en">
              {unlockStatus.have} of {unlockStatus.need} — content below is still browsable
            </span>
          </div>
        </div>
      )}

      <SubjectFilterBar accent={theme.base} jlptOptions={jlptOptions} />

      {nonEmptyGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-8">
          <span className="text-body text-text-dim">No matches.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {nonEmptyGroups.map((group) => (
            <SubjectLevelGroup
              key={group.key}
              level={group.level}
              items={group.items}
              count={group.count}
              open={group.open}
              toggleHref={toggleHrefFor(group.key, group.open)}
            />
          ))}
        </div>
      )}

      {!isFiltering && totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Level pages">
          {Array.from({ length: totalPages }, (_, i) => i).map((p) => {
            const start = allLevels[p * LEVELS_PER_PAGE];
            const end = allLevels[Math.min((p + 1) * LEVELS_PER_PAGE, allLevels.length) - 1];
            return (
              <Link
                key={p}
                href={`/subjects/${typeSlug}?page=${p}`}
                className={
                  "rounded-[var(--radius-chip)] border px-3 h-8 flex items-center text-micro font-medium transition-colors duration-[var(--duration-fast)] " +
                  (p === activePage
                    ? "border-line-strong bg-surface-3 text-text"
                    : "border-line bg-surface text-text-dim hover:text-text")
                }
              >
                {start}-{end}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function PageHeader({ labelEn, labelJa }: { labelEn: string; labelJa: string }) {
  return (
    <h1 className="text-h1 font-semibold text-text">
      <span lang="en">{labelEn}</span> <span lang="ja" className="text-text-muted">{labelJa}</span>
    </h1>
  );
}

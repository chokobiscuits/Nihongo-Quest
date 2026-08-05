import Link from "next/link";
import { getLessonBatchOrTutorial } from "@/server/queries/lessons";
import { LessonRunner } from "@/components/lessons/LessonRunner";
import { TutorialGate } from "@/components/tutorials/TutorialGate";
import { slugToType, ALL_TYPE_SLUGS } from "@/components/subject/typeSlug";

import { APP_USER_ID } from "@/lib/appUser";

const TYPE_LABEL: Record<string, { en: string; ja: string }> = {
  KANA: { en: "Kana", ja: "かな" },
  RADICAL: { en: "Radicals", ja: "部首" },
  KANJI: { en: "Kanji", ja: "漢字" },
  VOCAB: { en: "Vocabulary", ja: "語彙" },
  GRAMMAR: { en: "Grammar", ja: "文法" },
  SENTENCE: { en: "Sentences", ja: "例文" },
  READING: { en: "Reading", ja: "読解" },
};

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.type === "string" ? params.type : undefined;
  // An unrecognised ?type= degrades to the unfiltered batch rather than
  // erroring: a hand-edited URL should still teach you something.
  const onlyType = raw ? slugToType(raw) : null;
  // ...but say so, rather than silently serving a different result than asked.
  const unrecognisedType = raw && !onlyType ? raw : null;

  const result = await getLessonBatchOrTutorial(APP_USER_ID, onlyType ?? undefined);
  const label = onlyType ? TYPE_LABEL[onlyType] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-h1 font-semibold text-text">
          <span lang="en">Lessons</span> <span lang="ja" className="text-text-muted">レッスン</span>
          {label && (
            <span className="ml-2 text-h3 font-medium text-text-muted">
              <span lang="en">{label.en}</span> <span lang="ja">{label.ja}</span>
            </span>
          )}
        </h1>
        {onlyType && (
          <Link href="/lessons" className="text-body font-medium text-brand-text hover:underline">
            Study everything
          </Link>
        )}
      </div>

      {unrecognisedType && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <p className="text-body text-text">
            Didn&apos;t recognise <span className="font-mono font-medium">{unrecognisedType}</span>. Showing everything.
          </p>
          <p className="text-caption text-text-dim">
            Valid subjects:{" "}
            {ALL_TYPE_SLUGS.map((slug, i) => (
              <span key={slug}>
                {i > 0 && ", "}
                <Link href={`/lessons?type=${slug}`} className="text-brand-text hover:underline">
                  {slug}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}

      {result.kind === "tutorial" ? (
        <TutorialGate tutorial={result.tutorial} />
      ) : result.batch.length === 0 && onlyType ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <p className="text-body font-medium text-text">
            Nothing left to learn in {label?.en ?? "this subject"} right now.
          </p>
          <p className="text-caption text-text-dim">
            Either you have started everything available at your current level, or the next items are still locked.
          </p>
          <Link
            href="/lessons"
            className="mt-1 inline-flex h-9 w-fit items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
          >
            Study everything instead
          </Link>
        </div>
      ) : (
        <LessonRunner batch={result.batch} />
      )}
    </div>
  );
}

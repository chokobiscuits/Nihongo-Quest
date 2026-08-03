import { notFound } from "next/navigation";
import Link from "next/link";
import { slugToType } from "@/components/subject/typeSlug";
import { getSubjectDetail } from "@/server/queries/subjects";
import { SubjectDetailCard } from "@/components/subject/SubjectDetailCard";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type: typeSlug, slug: rawSlug } = await params;
  const subjectType = slugToType(typeSlug);
  if (!subjectType) notFound();

  // Subject slugs embed the raw kanji/kana character (e.g. "kanji-五"), so
  // the URL segment arrives percent-encoded and, unlike ASCII segments,
  // Next does not auto-decode it here — decode explicitly before the DB
  // lookup.
  const slug = decodeURIComponent(rawSlug);
  const subject = await getSubjectDetail(slug, APP_USER_ID);
  if (!subject || subject.type !== subjectType) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/subjects/${typeSlug}`} className="text-caption text-text-dim hover:text-text w-fit">
        ← Back
      </Link>
      <SubjectDetailCard subject={subject} />
    </div>
  );
}

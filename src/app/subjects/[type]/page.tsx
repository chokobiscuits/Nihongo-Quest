import { notFound } from "next/navigation";
import { SubjectType } from "@/generated/prisma/enums";
import { SUBJECT_THEME } from "@/components/subject/theme";

export function generateStaticParams() {
  return Object.values(SubjectType).map((type) => ({ type }));
}

export default async function SubjectTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const subjectType = type.toUpperCase() as SubjectType;

  if (!Object.values(SubjectType).includes(subjectType)) {
    notFound();
  }

  const theme = SUBJECT_THEME[subjectType];

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">{theme.labelEn}</span>{" "}
        <span lang="ja" className="text-text-muted">
          {theme.labelJa}
        </span>
      </h1>
      <p className="text-body text-text-dim">Subject list coming soon.</p>
    </div>
  );
}

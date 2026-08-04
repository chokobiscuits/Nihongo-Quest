import { notFound } from "next/navigation";
import Link from "next/link";
import { getTutorialBySlug } from "@/server/queries/tutorials";
import { Panel } from "@/components/panel/Panel";
import { TutorialBody } from "@/components/tutorials/TutorialBody";
import { TutorialIcon } from "@/components/shell/NavIcons";
import { MarkReadButton } from "@/components/tutorials/MarkReadButton";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

export default async function TutorialDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutorial = await getTutorialBySlug(slug, APP_USER_ID);
  if (!tutorial) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/tutorials" className="text-caption text-text-dim hover:text-text w-fit">
        ← Back
      </Link>

      <Panel accent="var(--color-brand)" icon={<TutorialIcon />} title={tutorial.titleEn} titleJa={tutorial.titleJa}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-caption text-text-faint">
            <span>{tutorial.estimatedMinutes} min</span>
            {tutorial.required && (
              <span className="rounded-[var(--radius-chip)] bg-surface-3 px-2 py-0.5 text-micro text-text-dim">
                Required
              </span>
            )}
            {tutorial.completed && (
              <span
                className="rounded-[var(--radius-chip)] px-2 py-0.5 text-micro"
                style={{ background: "var(--color-success)", color: "var(--color-canvas)" }}
              >
                Completed
              </span>
            )}
          </div>
          <TutorialBody markdown={tutorial.body} />
          <MarkReadButton tutorialId={tutorial.id} completed={tutorial.completed} />
        </div>
      </Panel>
    </div>
  );
}

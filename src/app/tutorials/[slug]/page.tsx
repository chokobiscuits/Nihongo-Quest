import { notFound } from "next/navigation";
import Link from "next/link";
import { getTutorialBySlug } from "@/server/queries/tutorials";
import { Panel } from "@/components/panel/Panel";
import { TutorialBody } from "@/components/tutorials/TutorialBody";
import { TutorialIcon } from "@/components/shell/NavIcons";
import { MarkReadButton } from "@/components/tutorials/MarkReadButton";
import { SkipFirstRunButton } from "@/components/tutorials/SkipFirstRunButton";

import { APP_USER_ID } from "@/lib/appUser";

export default async function TutorialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { slug } = await params;
  const { welcome } = await searchParams;
  const tutorial = await getTutorialBySlug(slug, APP_USER_ID);
  if (!tutorial) notFound();

  // Welcome mode: the user was redirected here from "/" on a brand-new or
  // freshly reset account and has never seen the app. The tutorial library
  // is meaningless context for them, so swap the back link for a greeting
  // and give them a way forward that does not bounce off the redirect.
  const isFirstRun = welcome === "1";

  return (
    <div className="flex flex-col gap-4">
      {isFirstRun ? (
        <p className="text-caption text-text-dim w-fit" lang="en">
          Welcome — start here.
        </p>
      ) : (
        <Link href="/tutorials" className="text-caption text-text-dim hover:text-text w-fit">
          ← Back
        </Link>
      )}

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
          <MarkReadButton
            tutorialId={tutorial.id}
            completed={tutorial.completed}
            redirectTo={isFirstRun ? "/" : undefined}
            label={isFirstRun ? "Got it, let's start" : undefined}
          />
          {isFirstRun && !tutorial.completed && <SkipFirstRunButton tutorialId={tutorial.id} />}
        </div>
      </Panel>
    </div>
  );
}

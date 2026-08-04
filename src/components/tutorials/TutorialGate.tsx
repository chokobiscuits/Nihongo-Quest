"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/panel/Panel";
import { TutorialBody } from "./TutorialBody";
import { TutorialIcon } from "@/components/shell/NavIcons";
import { acknowledgeTutorialAction } from "@/server/actions/tutorials";
import type { TutorialDetail } from "@/server/queries/tutorials";

export interface TutorialGateProps {
  tutorial: TutorialDetail;
}

/// Blocks the lesson flow on a single REQUIRED, currently-triggered tutorial:
/// renders its body and an "I understand" button that writes the
/// TutorialCompletion, then refreshes so /lessons re-evaluates — either the
/// next required tutorial (ordered by `order`) or actual lesson items.
export function TutorialGate({ tutorial }: TutorialGateProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAcknowledge() {
    setError(null);
    startTransition(async () => {
      try {
        await acknowledgeTutorialAction(tutorial.id);
        router.refresh();
      } catch {
        setError("Something went wrong saving this. Try again.");
      }
    });
  }

  return (
    <Panel accent="var(--color-brand)" icon={<TutorialIcon />} title={tutorial.titleEn} titleJa={tutorial.titleJa}>
      <div className="flex flex-col gap-4">
        <TutorialBody markdown={tutorial.body} />

        {error && <p className="text-caption text-danger">{error}</p>}

        <button
          type="button"
          onClick={handleAcknowledge}
          disabled={pending}
          className="self-start rounded-[var(--radius-chip)] bg-brand px-4 h-9 text-body font-medium text-canvas disabled:opacity-60"
        >
          {pending ? "Saving…" : "I understand"}
        </button>
      </div>
    </Panel>
  );
}

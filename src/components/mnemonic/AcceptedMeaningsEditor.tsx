"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { saveMnemonic } from "@/server/actions/mnemonics";

export interface AcceptedMeaningsEditorProps {
  subjectId: string;
  value: string[];
  accentColor: string;
  className?: string;
}

/// Tag editor for `Subject.acceptedMeanings` — synonym whitelist accepted as
/// correct on top of the seeded meanings during grading. Add via text input
/// + Enter, remove via the chip's ×. Persists through the same
/// `saveMnemonic` action the mnemonic fields use.
export function AcceptedMeaningsEditor({ subjectId, value, accentColor, className }: AcceptedMeaningsEditorProps) {
  const [tags, setTags] = useState(value);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  function persist(next: string[]) {
    setTags(next);
    startTransition(async () => {
      await saveMnemonic({ subjectId, acceptedMeanings: next });
    });
  }

  function addTag() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || tags.includes(trimmed)) {
      setDraft("");
      return;
    }
    persist([...tags, trimmed]);
    setDraft("");
  }

  function removeTag(tag: string) {
    persist(tags.filter((t) => t !== tag));
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-micro font-medium uppercase tracking-wide text-text-dim" lang="en">
        Accepted synonyms
      </span>
      <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-tile)] border border-line bg-surface-2 p-2.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-chip)] border px-2.5 text-caption text-text"
            style={{ borderColor: `color-mix(in oklch, ${accentColor} 40%, transparent)`, background: `color-mix(in oklch, ${accentColor} 12%, transparent)` }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="text-text-faint hover:text-text"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? "Add a synonym and press Enter" : "Add another..."}
          disabled={isPending}
          className="h-7 min-w-[140px] flex-1 bg-transparent text-caption text-text outline-none placeholder:text-text-faint"
        />
      </div>
    </div>
  );
}

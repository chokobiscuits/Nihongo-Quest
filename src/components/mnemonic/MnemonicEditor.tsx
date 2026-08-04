"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { saveMnemonic } from "@/server/actions/mnemonics";

export interface MnemonicEditorProps {
  subjectId: string;
  field: "meaningMnemonic" | "readingMnemonic";
  label: string;
  value: string | null;
  /// The subject's glyph, interpolated into the empty-state prompt.
  characters: string | null;
  /// `theme.base` — accents the empty-state left edge and pencil glyph.
  accentColor: string;
  className?: string;
}

/// Inline mnemonic slot: an inviting empty state when unset, a save/cancel
/// affordance once the user starts typing. Persists via the `saveMnemonic`
/// server action and sets `Subject.authored = true` on save.
export function MnemonicEditor({
  subjectId,
  field,
  label,
  value,
  characters,
  accentColor,
  className,
}: MnemonicEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saved, setSaved] = useState(value);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <span className="text-micro font-medium uppercase tracking-wide text-text-dim" lang="en">
          {label}
        </span>
        {saved ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-[var(--radius-tile)] border border-line bg-surface p-3 min-h-[72px] text-left text-body text-text hover:border-line-strong hover:bg-surface-2 transition-colors duration-[var(--duration-fast)]"
          >
            {saved}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex w-full min-h-[72px] items-center justify-between gap-3 rounded-[var(--radius-tile)] border border-line bg-surface-2 p-4 text-left hover:border-line-strong hover:bg-surface-3 transition-colors duration-[var(--duration-fast)]"
            style={{ borderLeft: `2px solid ${accentColor}` }}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-text">
                Write a mnemonic for {characters ?? "this"}
              </span>
              <span className="text-caption text-text-dim">
                A silly image sticks better than a definition.
              </span>
            </span>
            <span
              aria-hidden
              className="text-h3 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity duration-[var(--duration-fast)]"
              style={{ color: accentColor }}
            >
              ✎
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-micro font-medium uppercase tracking-wide text-text-dim" lang="en">
        {label}
      </span>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        className="rounded-[var(--radius-input)] border border-line-strong bg-surface p-3 text-body text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await saveMnemonic({ subjectId, [field]: draft || null });
              setSaved(draft || null);
              setEditing(false);
            });
          }}
          className="rounded-[var(--radius-chip)] bg-brand px-3 h-8 text-caption font-medium text-on-brand disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(saved ?? "");
            setEditing(false);
          }}
          className="rounded-[var(--radius-chip)] border border-line px-3 h-8 text-caption font-medium text-text-dim hover:text-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { Panel, InsetPanel } from "@/components/panel/Panel";
import { cn } from "@/lib/utils";
import {
  updateDisplayName,
  updateLessonBatchSize,
  updateFuriganaOverride,
  updateTimezone,
  uploadAvatar,
  removeAvatar,
} from "@/server/actions/settings";

export interface SettingsFormProps {
  initial: {
    displayName: string;
    avatarUrl: string | null;
    lessonBatchSize: number;
    furiganaOverride: boolean | null;
    timezone: string;
  };
}

// A short, commonly-relevant list rather than the full ~400-entry IANA
// database — matches the server action's comment in settings.ts. Any valid
// IANA id would be accepted server-side; this is just the picker's options.
const TIMEZONE_OPTIONS = [
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Auckland",
  "UTC",
];

const INPUT_CLASS =
  "h-10 w-full rounded-[var(--radius-input)] border border-line bg-surface-2 px-3 text-sub text-text outline-none transition-colors duration-[var(--duration-fast)] focus-visible:border-[var(--color-focus)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-micro font-medium uppercase tracking-wide text-text-dim" lang="en">
      {children}
    </span>
  );
}

function StatusNote({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className={cn("text-micro", status === "error" ? "text-danger" : "text-success")} lang="en">
      {status === "saving" ? "Saving..." : status === "error" ? "Could not save." : "Saved."}
    </span>
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/// Client-side settings form. Every field persists independently via its own
/// server action call on blur/change — no single giant "Save" button, so a
/// change to one field never risks clobbering another that's mid-edit.
export function SettingsForm({ initial }: SettingsFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <DisplayNameField initial={initial.displayName} />
      <AvatarField initialUrl={initial.avatarUrl} />
      <LessonBatchSizeField initial={initial.lessonBatchSize} />
      <FuriganaField initial={initial.furiganaOverride} />
      <TimezoneField initial={initial.timezone} />
    </div>
  );
}

function DisplayNameField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === initial) return;
    setStatus("saving");
    startTransition(async () => {
      const result = await updateDisplayName(trimmed);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  return (
    <Panel accent="var(--color-brand)" title="Display Name" titleJa="表示名">
      <div className="flex flex-col gap-2">
        <FieldLabel>Name</FieldLabel>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
          maxLength={40}
          disabled={isPending}
          className={INPUT_CLASS}
        />
        <StatusNote status={status} />
      </div>
    </Panel>
  );
}

function AvatarField({ initialUrl }: { initialUrl: string | null }) {
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatus("saving");

    startTransition(async () => {
      const bytes = await file.arrayBuffer();
      const result = await uploadAvatar(bytes, file.type);
      if (result.ok && result.avatarPath) {
        setPreviewUrl(`/uploads/${result.avatarPath}`);
        setStatus("saved");
      } else {
        setError(result.error ?? "Upload failed.");
        setStatus("error");
      }
    });
  }

  function handleRemove() {
    setStatus("saving");
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.ok) {
        setPreviewUrl(null);
        setStatus("saved");
      } else {
        setStatus("error");
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Panel accent="var(--color-brand)" title="Profile Picture" titleJa="プロフィール画像">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-surface-3"
            aria-hidden
          >
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              disabled={isPending}
              className="text-caption text-text-dim file:mr-3 file:rounded-[var(--radius-chip)] file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-caption file:text-text file:hover:bg-surface-2"
            />
            {previewUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="w-fit text-caption text-danger hover:underline"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        <span className="text-micro text-text-faint" lang="en">
          PNG, JPEG, WebP, or GIF. Max 2MB — normalized to a 512px square.
        </span>
        {error && (
          <span className="text-micro text-danger" lang="en">
            {error}
          </span>
        )}
        <StatusNote status={status} />
      </div>
    </Panel>
  );
}

function LessonBatchSizeField({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [isPending, startTransition] = useTransition();

  function save(next: number) {
    if (next === initial || !Number.isInteger(next) || next < 1 || next > 20) return;
    setStatus("saving");
    startTransition(async () => {
      const result = await updateLessonBatchSize(next);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  return (
    <Panel accent="var(--color-kanji)" title="Lesson Batch Size" titleJa="レッスンの一括数">
      <div className="flex flex-col gap-2">
        <FieldLabel>Items per lesson batch</FieldLabel>
        <input
          type="number"
          min={1}
          max={20}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onBlur={() => save(value)}
          disabled={isPending}
          className={cn(INPUT_CLASS, "max-w-[120px]")}
        />
        <span className="text-micro text-text-faint" lang="en">
          Between 1 and 20. Defaults to 5.
        </span>
        <StatusNote status={status} />
      </div>
    </Panel>
  );
}

function FuriganaField({ initial }: { initial: boolean | null }) {
  const [value, setValue] = useState<boolean | null>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [isPending, startTransition] = useTransition();

  function save(next: boolean | null) {
    setValue(next);
    setStatus("saving");
    startTransition(async () => {
      const result = await updateFuriganaOverride(next);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  const OPTIONS: { label: string; value: boolean | null }[] = [
    { label: "Always show", value: true },
    { label: "Always hide", value: false },
    { label: "Default by level", value: null },
  ];

  return (
    <Panel accent="var(--color-vocab)" title="Furigana" titleJa="ふりがな">
      <div className="flex flex-col gap-2">
        <FieldLabel>Furigana visibility</FieldLabel>
        <InsetPanel className="flex flex-wrap gap-2">
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                disabled={isPending}
                onClick={() => save(opt.value)}
                className={cn(
                  "h-8 rounded-[var(--radius-chip)] border px-3 text-caption transition-colors duration-[var(--duration-fast)]",
                  active
                    ? "border-transparent bg-vocab text-[var(--color-vocab-text)]"
                    : "border-line text-text-dim hover:bg-surface-3",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </InsetPanel>
        <span className="text-micro text-text-faint" lang="en">
          &ldquo;Default by level&rdquo; hides furigana once you reach Master (level 65).
        </span>
        <StatusNote status={status} />
      </div>
    </Panel>
  );
}

function TimezoneField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [isPending, startTransition] = useTransition();

  function save(next: string) {
    setValue(next);
    setStatus("saving");
    startTransition(async () => {
      const result = await updateTimezone(next);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  return (
    <Panel accent="var(--color-radical)" title="Timezone" titleJa="タイムゾーン">
      <div className="flex flex-col gap-2">
        <FieldLabel>Timezone</FieldLabel>
        <select
          value={value}
          onChange={(e) => save(e.target.value)}
          disabled={isPending}
          className={cn(INPUT_CLASS, "max-w-[280px]")}
        >
          {!TIMEZONE_OPTIONS.includes(value) && <option value={value}>{value}</option>}
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <span className="text-micro text-text-faint" lang="en">
          Drives your daily streak&rsquo;s day boundary. Defaults to Asia/Tokyo.
        </span>
        <StatusNote status={status} />
      </div>
    </Panel>
  );
}

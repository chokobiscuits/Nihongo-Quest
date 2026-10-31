"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { markChangelogSeen } from "@/server/actions/settings";
import { isChangelogSuppressedPath } from "@/services/changelog/visibility";
import { cn } from "@/lib/utils";

export interface ChangelogPopupProps {
  /// The release to announce. The layout passes null when nothing should be
  /// shown (already seen, still onboarding, or the database is down).
  release: { id: string; title: string; date: string; highlights: string[] } | null;
}

/// The "What's new" modal, shown once per release after an update.
///
/// The server decides whether a release is unseen (see shouldShowChangelog);
/// this component only decides when it is calm enough to show it. It opens
/// from the first render's props and then keeps its own `dismissed` state, so
/// a later router.refresh() that re-sends the same unseen release (the save
/// has not landed yet) cannot reopen it, and a refresh in the middle of a
/// session cannot make it appear over a celebration modal: on lesson and
/// review routes it simply waits.
///
/// Mirrors CelebrationModal: portal to document.body, the same overlay and
/// entrance animation, Escape to close, focus pinned inside the dialog.
export function ChangelogPopup({ release }: ChangelogPopupProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // document.body does not exist during SSR; a server snapshot of `false`
  // keeps the first client render identical to the server's (nothing).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const open = Boolean(release) && !dismissed && !isChangelogSuppressedPath(pathname);

  // Focus the dismiss button on open and give focus back on close.
  useEffect(() => {
    if (!open || !mounted) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dismissRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key === "Tab") {
        // Two focusable elements: keep Tab cycling between them.
        const first = linkRef.current;
        const last = dismissRef.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (document.activeElement !== first && document.activeElement !== last) {
          e.preventDefault();
          last.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /// Closes immediately and saves in the background. A failed save only means
  /// the notice returns on the next full load, which is harmless.
  function dismiss() {
    if (!release) return;
    setDismissed(true);
    void markChangelogSeen(release.id).catch(() => {});
  }

  if (!open || !mounted || !release) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 celebration-overlay"
      style={{ background: "oklch(0.08 0.02 295 / 0.88)", backdropFilter: "blur(6px)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-popup-heading"
        aria-describedby="changelog-popup-list"
        className={cn(
          "flex max-h-[85dvh] w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-[var(--radius-card)] border border-line-strong bg-surface p-6",
          "shadow-[0_1px_0_0_oklch(1_0_0/0.045)_inset,0_24px_48px_-16px_oklch(0_0_0/0.8)]",
          !reducedMotion && "celebration-hero",
        )}
      >
        <div className="flex flex-col gap-1">
          <span className="text-micro font-semibold uppercase tracking-[0.08em] text-brand-text" lang="en">
            What&apos;s new
          </span>
          <h2 id="changelog-popup-heading" className="text-h2 font-semibold text-text" lang="en">
            {release.title}
          </h2>
          <span className="text-micro text-text-faint" lang="en">
            {release.date}
          </span>
        </div>

        <ul id="changelog-popup-list" className="flex list-disc flex-col gap-2 pl-5 text-body text-text-muted">
          {release.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            ref={linkRef}
            href="/changelog"
            onClick={dismiss}
            className="text-caption font-medium text-text-dim underline-offset-2 hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          >
            See full changelog
          </Link>
          <button
            ref={dismissRef}
            type="button"
            onClick={dismiss}
            className="rounded-[var(--radius-chip)] bg-brand-button px-6 h-10 text-body font-semibold text-on-brand hover:bg-brand-button-hover transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

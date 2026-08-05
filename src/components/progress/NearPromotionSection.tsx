import Link from "next/link";
import { SrsStageChip } from "@/components/srs/SrsStageChip";
import { typeToSlug } from "@/components/subject/typeSlug";
import type { NearPromotionGroup } from "@/server/queries/progress";

export interface NearPromotionSectionProps {
  groups: NearPromotionGroup[];
  /// Reference time for the due/not-due split, passed in so the server
  /// component and the rendered markup agree (no client clock).
  now: Date;
}

function waitLabel(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return "due now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `in ${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

/// Items one correct review away from moving up an SRS stage, grouped by
/// subject type. Due items lead each group, since those are the ones the
/// user can act on right now; a Guru crossing is called out because that is
/// the promotion that unlocks dependent subjects.
export function NearPromotionSection({ groups, now }: NearPromotionSectionProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-body text-text-dim">
        Nothing in progress yet. Learn some items and they&apos;ll show up here as they approach their next stage.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.type} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-h3 font-semibold text-text">
              <span lang="en">{group.labelEn}</span>{" "}
              <span lang="ja" className="text-body text-text-muted">
                {group.labelJa}
              </span>
            </h3>
            <span className="text-caption text-text-faint">
              {group.total} in progress
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-line">
            {group.items.map((item, itemIndex) => {
              const isDue = item.dueAt === null || item.dueAt <= now;
              return (
                <li
                  key={item.userSubjectId}
                  className="entrance-staggered flex items-center gap-3 py-2"
                  style={{ "--entrance-index": itemIndex } as React.CSSProperties}
                >
                  <Link
                    href={`/subjects/${typeToSlug(group.type)}/${item.slug}`}
                    className="min-w-0 flex-1 truncate text-body text-text hover:underline"
                  >
                    {item.characters ? (
                      <span lang="ja" className="text-h3 font-medium">
                        {item.characters}
                      </span>
                    ) : null}
                    {item.meaning ? (
                      <span className={item.characters ? "ml-2 text-text-dim" : "text-text"} lang="en">
                        {item.meaning}
                      </span>
                    ) : null}
                  </Link>

                  {item.unlocksAtGuru && (
                    <span
                      className="shrink-0 rounded-[var(--radius-chip)] px-1.5 py-0.5 text-caption font-medium"
                      style={{
                        background: "color-mix(in oklch, var(--color-rank-gold) 18%, transparent)",
                        color: "var(--color-rank-gold)",
                      }}
                      title="Reaching Guru unlocks dependent subjects"
                    >
                      Guru next
                    </span>
                  )}

                  <div className="flex shrink-0 items-center gap-1.5">
                    <SrsStageChip stage={item.srsStage} />
                    <span className="text-caption text-text-faint" aria-hidden>
                      →
                    </span>
                    <SrsStageChip stage={item.nextStage} />
                  </div>

                  <span
                    className={`w-16 shrink-0 text-right text-caption ${isDue ? "text-brand-text" : "text-text-faint"}`}
                  >
                    {item.dueAt === null ? "due now" : waitLabel(now, item.dueAt)}
                  </span>
                </li>
              );
            })}
          </ul>

          {group.total > group.items.length && (
            <span className="text-caption text-text-faint">
              +{group.total - group.items.length} more
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

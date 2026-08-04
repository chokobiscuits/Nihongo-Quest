import Link from "next/link";
import { getUnrankedReviewQueue } from "@/server/queries/reviews";
import { UnrankedRunner } from "@/components/reviews/UnrankedRunner";
import { SubjectType } from "@/generated/prisma/enums";

import { APP_USER_ID } from "@/lib/appUser";

const VALID_TYPES = new Set<string>(Object.values(SubjectType));

/// Parses the comma-separated `types` / `levels` query params written by
/// UnrankedPicker. Unknown types and non-numeric levels are dropped rather
/// than erroring: a hand-edited URL should degrade to a broader session, not
/// a crash.
function parseFilter(params: Record<string, string | string[] | undefined>) {
  const raw = (key: string): string[] => {
    const v = params[key];
    if (typeof v !== "string" || v.length === 0) return [];
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const types = raw("types").filter((t) => VALID_TYPES.has(t)) as SubjectType[];
  const levels = raw("levels")
    .map((l) => Number.parseInt(l, 10))
    .filter((n) => Number.isInteger(n) && n > 0);

  return { types, levels };
}

export default async function UnrankedSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params);
  const items = await getUnrankedReviewQueue(APP_USER_ID, filter);

  const backHref = "/reviews/practice";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-h1 font-semibold text-text">
          <span lang="en">Practice</span> <span lang="ja" className="text-text-muted">自主練</span>
        </h1>
        <Link href={backHref} className="text-body font-medium text-brand-text hover:underline">
          Change selection
        </Link>
      </div>
      <UnrankedRunner items={items} pickerHref={backHref} />
    </div>
  );
}

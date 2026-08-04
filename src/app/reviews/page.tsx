import { getReviewQueue } from "@/server/queries/reviews";
import { ReviewRunner } from "@/components/reviews/ReviewRunner";

import { APP_USER_ID } from "@/lib/appUser";

export default async function ReviewsPage() {
  const { items } = await getReviewQueue(APP_USER_ID);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Reviews</span> <span lang="ja" className="text-text-muted">復習</span>
      </h1>
      <ReviewRunner items={items} />
    </div>
  );
}

import { getLessonBatch } from "@/server/queries/lessons";
import { LessonRunner } from "@/components/lessons/LessonRunner";

const APP_USER_ID = process.env.APP_USER_ID ?? "local-user";

export default async function LessonsPage() {
  const batch = await getLessonBatch(APP_USER_ID);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Lessons</span> <span lang="ja" className="text-text-muted">レッスン</span>
      </h1>
      <LessonRunner batch={batch} />
    </div>
  );
}

import { getLessonBatchOrTutorial } from "@/server/queries/lessons";
import { LessonRunner } from "@/components/lessons/LessonRunner";
import { TutorialGate } from "@/components/tutorials/TutorialGate";

import { APP_USER_ID } from "@/lib/appUser";

export default async function LessonsPage() {
  const result = await getLessonBatchOrTutorial(APP_USER_ID);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 font-semibold text-text">
        <span lang="en">Lessons</span> <span lang="ja" className="text-text-muted">レッスン</span>
      </h1>
      {result.kind === "tutorial" ? (
        <TutorialGate tutorial={result.tutorial} />
      ) : (
        <LessonRunner batch={result.batch} />
      )}
    </div>
  );
}

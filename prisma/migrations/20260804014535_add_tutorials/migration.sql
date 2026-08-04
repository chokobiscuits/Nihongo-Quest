-- CreateTable
CREATE TABLE "Tutorial" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleJa" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "trigger" JSONB NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Tutorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorialCompletion" (
    "userId" TEXT NOT NULL,
    "tutorialId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TutorialCompletion_pkey" PRIMARY KEY ("userId","tutorialId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tutorial_slug_key" ON "Tutorial"("slug");

-- CreateIndex
CREATE INDEX "TutorialCompletion_userId_idx" ON "TutorialCompletion"("userId");

-- AddForeignKey
ALTER TABLE "TutorialCompletion" ADD CONSTRAINT "TutorialCompletion_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "Tutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

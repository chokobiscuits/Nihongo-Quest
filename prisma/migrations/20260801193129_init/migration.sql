-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('RADICAL', 'KANJI', 'VOCAB', 'GRAMMAR', 'SENTENCE', 'READING');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MEANING', 'READING');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('LESSON', 'REVIEW', 'EXAM');

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "type" "SubjectType" NOT NULL,
    "level" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "characters" TEXT,
    "imageUrl" TEXT,
    "meanings" JSONB NOT NULL,
    "readings" JSONB NOT NULL,
    "meaningMnemonic" TEXT,
    "readingMnemonic" TEXT,
    "meaningHint" TEXT,
    "readingHint" TEXT,
    "acceptedMeanings" JSONB NOT NULL DEFAULT '[]',
    "authored" BOOLEAN NOT NULL DEFAULT false,
    "jlpt" INTEGER,
    "jlptLegacy" INTEGER,
    "frequency" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "furigana" JSONB,
    "furiganaFallback" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectComponent" (
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "position" TEXT,
    "isRadical" BOOLEAN NOT NULL DEFAULT false,
    "readingUsed" TEXT,

    CONSTRAINT "SubjectComponent_pkey" PRIMARY KEY ("parentId","childId")
);

-- CreateTable
CREATE TABLE "UserSubject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "srsStage" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "passedAt" TIMESTAMP(3),
    "burnedAt" TIMESTAMP(3),
    "meaningCorrect" INTEGER NOT NULL DEFAULT 0,
    "meaningIncorrect" INTEGER NOT NULL DEFAULT 0,
    "readingCorrect" INTEGER NOT NULL DEFAULT 0,
    "readingIncorrect" INTEGER NOT NULL DEFAULT 0,
    "masteryLevel" INTEGER NOT NULL DEFAULT 0,
    "masteryXp" INTEGER NOT NULL DEFAULT 0,
    "lastPromotedAt" TIMESTAMP(3),

    CONSTRAINT "UserSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "userSubjectId" TEXT NOT NULL,
    "sessionId" TEXT,
    "questionType" "QuestionType" NOT NULL,
    "incorrectCount" INTEGER NOT NULL,
    "startedStage" INTEGER NOT NULL,
    "endedStage" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "scope" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "correctItems" INTEGER NOT NULL DEFAULT 0,
    "scorePct" DOUBLE PRECISION,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarPath" TEXT,
    "totalXp" BIGINT NOT NULL DEFAULT 0,
    "accountLevel" INTEGER NOT NULL DEFAULT 1,
    "rank" TEXT NOT NULL DEFAULT 'IRON',
    "rankDivision" INTEGER,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDay" DATE,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lessonCount" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "versionDate" DATE NOT NULL,
    "attribution" TEXT NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE INDEX "Subject_type_level_idx" ON "Subject"("type", "level");

-- CreateIndex
CREATE INDEX "Subject_jlpt_idx" ON "Subject"("jlpt");

-- CreateIndex
CREATE INDEX "SubjectComponent_childId_idx" ON "SubjectComponent"("childId");

-- CreateIndex
CREATE INDEX "UserSubject_userId_srsStage_dueAt_idx" ON "UserSubject"("userId", "srsStage", "dueAt");

-- CreateIndex
CREATE INDEX "UserSubject_userId_passedAt_idx" ON "UserSubject"("userId", "passedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubject_userId_subjectId_key" ON "UserSubject"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "ReviewLog_userSubjectId_answeredAt_idx" ON "ReviewLog"("userSubjectId", "answeredAt");

-- CreateIndex
CREATE INDEX "ReviewLog_answeredAt_idx" ON "ReviewLog"("answeredAt");

-- CreateIndex
CREATE INDEX "Session_userId_kind_startedAt_idx" ON "Session"("userId", "kind", "startedAt");

-- CreateIndex
CREATE INDEX "XpEvent_userId_createdAt_idx" ON "XpEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubjectComponent" ADD CONSTRAINT "SubjectComponent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectComponent" ADD CONSTRAINT "SubjectComponent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubject" ADD CONSTRAINT "UserSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userSubjectId_fkey" FOREIGN KEY ("userSubjectId") REFERENCES "UserSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

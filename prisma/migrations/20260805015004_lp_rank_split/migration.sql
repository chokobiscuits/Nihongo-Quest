-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "lp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "peakRank" TEXT NOT NULL DEFAULT 'IRON',
ADD COLUMN     "peakRankDivision" INTEGER DEFAULT 4,
ALTER COLUMN "rankDivision" SET DEFAULT 4;

-- CreateTable
CREATE TABLE "LpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sessionId" TEXT,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "tierAfter" TEXT NOT NULL,
    "divisionAfter" INTEGER,
    "lpAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LpEvent_userId_createdAt_idx" ON "LpEvent"("userId", "createdAt");

-- CreateTable
CREATE TABLE "UserMnemonic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "meaningMnemonic" TEXT,
    "readingMnemonic" TEXT,
    "meaningHint" TEXT,
    "readingHint" TEXT,
    "acceptedMeanings" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMnemonic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserMnemonic_userId_subjectId_key" ON "UserMnemonic"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "UserMnemonic_userId_idx" ON "UserMnemonic"("userId");

-- AddForeignKey
ALTER TABLE "UserMnemonic" ADD CONSTRAINT "UserMnemonic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: carry forward any existing user-authored mnemonic/hint/
-- accepted-meaning content from the shared Subject row to a UserMnemonic row
-- owned by the pre-multi-user owner account, rather than silently discarding
-- it now that Subject's USER-AUTHORED block is a seeded-default fallback
-- only. 'local-user' is this app's pre-existing single-owner UserProfile.userId
-- (see scripts/sim/progression.ts and scripts/verify-*.ts, all of which key
-- off that same id as "the real user"). Only rows the user actually touched
-- (authored = true, or a non-default mnemonicSource) are migrated; plain
-- seeded/generated content is left on Subject to keep acting as the fallback.
--
-- If this app's real owner UserProfile.userId is not literally 'local-user'
-- in the environment this migration is applied to, update the literal below
-- (or re-point it at the OWNER_APP_USER_ID value used for
-- scripts/provision-auth-users.ts) before running `prisma migrate deploy`.
INSERT INTO "UserMnemonic" ("id", "userId", "subjectId", "meaningMnemonic", "readingMnemonic", "meaningHint", "readingHint", "acceptedMeanings", "updatedAt")
SELECT
    gen_random_uuid()::text,
    'local-user',
    "id",
    "meaningMnemonic",
    "readingMnemonic",
    "meaningHint",
    "readingHint",
    "acceptedMeanings",
    now()
FROM "Subject"
WHERE "authored" = true
  AND EXISTS (SELECT 1 FROM "UserProfile" WHERE "userId" = 'local-user')
ON CONFLICT ("userId", "subjectId") DO NOTHING;

CREATE TYPE "SessionFamilyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "SessionFamilyRevocationReason" AS ENUM ('LOGOUT', 'LOGOUT_ALL', 'PASSWORD_CHANGED', 'SECURITY_EVENT', 'REPLAY_DETECTED', 'USER_DISABLED');

CREATE TABLE "SessionFamily" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRefreshedAt" TIMESTAMP(3),
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "status" "SessionFamilyStatus" NOT NULL DEFAULT 'ACTIVE',
  "revocationReason" "SessionFamilyRevocationReason",
  CONSTRAINT "SessionFamily_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SessionFamily" ADD CONSTRAINT "SessionFamily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SessionFamily_userId_status_idx" ON "SessionFamily"("userId", "status");
CREATE INDEX "SessionFamily_status_absoluteExpiresAt_idx" ON "SessionFamily"("status", "absoluteExpiresAt");

ALTER TABLE "AuthSession" ADD COLUMN "familyId" TEXT, ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "consumedAt" TIMESTAMP(3), ADD COLUMN "idleExpiresAt" TIMESTAMP(3);
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "SessionFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AuthSession_familyId_generation_idx" ON "AuthSession"("familyId", "generation");
CREATE INDEX "AuthSession_familyId_consumedAt_idx" ON "AuthSession"("familyId", "consumedAt");

-- FW-02-R-WAVE-REDEMPTION-SCHEMA-MIGRATION-08B
-- Additive local/test-only schema change. No financial side effects.
CREATE TYPE "RedemptionStatus" AS ENUM ('INITIATED', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REVERSED');

CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "benefitMembershipId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "verificationTokenHash" TEXT NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'INITIATED',
    "benefitSnapshot" JSONB NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Redemption_verificationTokenHash_key" ON "Redemption"("verificationTokenHash");
CREATE UNIQUE INDEX "Redemption_customerUserId_idempotencyKey_key" ON "Redemption"("customerUserId", "idempotencyKey");
CREATE INDEX "Redemption_providerId_status_createdAt_idx" ON "Redemption"("providerId", "status", "createdAt");
CREATE INDEX "Redemption_customerUserId_status_createdAt_idx" ON "Redemption"("customerUserId", "status", "createdAt");
CREATE INDEX "Redemption_tokenExpiresAt_status_idx" ON "Redemption"("tokenExpiresAt", "status");

ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_benefitMembershipId_fkey" FOREIGN KEY ("benefitMembershipId") REFERENCES "BenefitMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

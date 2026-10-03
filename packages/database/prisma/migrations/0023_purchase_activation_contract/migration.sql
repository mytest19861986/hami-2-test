-- Wave 33: additive purchase payment / activation separation.
-- Local/test implementation; no provider integration or financial recalculation.

ALTER TYPE "BenefitMembershipStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
CREATE TYPE "ActivationMode" AS ENUM ('MANUAL', 'AUTO');

ALTER TABLE "CommercialSettings"
  ADD COLUMN "autoActivatePaidPurchases" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PlanPurchase"
  ADD COLUMN "refundReference" TEXT,
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundedByUserId" TEXT;

ALTER TABLE "BenefitMembership"
  ADD COLUMN "activationMode" "ActivationMode",
  ADD COLUMN "decisionAt" TIMESTAMP(3),
  ADD COLUMN "decisionByUserId" TEXT,
  ADD COLUMN "decisionReasonCode" TEXT,
  ADD COLUMN "activationHoldReasonCode" TEXT;

ALTER TABLE "AuditLog"
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PlanPurchase_refundReference_key"
  ON "PlanPurchase"("refundReference");
CREATE UNIQUE INDEX "AuditLog_idempotencyKey_key"
  ON "AuditLog"("idempotencyKey");
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx"
  ON "AuditLog"("entity", "entityId", "createdAt");

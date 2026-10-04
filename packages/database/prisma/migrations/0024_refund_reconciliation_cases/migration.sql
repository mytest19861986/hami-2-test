-- Wave 35: internal refund/reconciliation case workflow only.
-- Does not mark purchases refunded or execute/reverse financial transactions.

CREATE TYPE "RefundCaseStatus" AS ENUM (
  'REQUESTED',
  'APPROVED_PENDING_EXECUTION',
  'REJECTED'
);

CREATE TABLE "RefundReconciliationCase" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "RefundCaseStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestReasonCode" TEXT NOT NULL,
  "requestIdempotencyKey" TEXT NOT NULL,
  "decisionByUserId" TEXT,
  "decisionReasonCode" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundReconciliationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundReconciliationCase_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "PlanPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RefundReconciliationCase_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RefundReconciliationCase_decisionByUserId_fkey"
    FOREIGN KEY ("decisionByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RefundReconciliationCase_purchaseId_key"
  ON "RefundReconciliationCase"("purchaseId");
CREATE UNIQUE INDEX "RefundReconciliationCase_requestIdempotencyKey_key"
  ON "RefundReconciliationCase"("requestIdempotencyKey");
CREATE INDEX "RefundReconciliationCase_status_createdAt_idx"
  ON "RefundReconciliationCase"("status", "createdAt");

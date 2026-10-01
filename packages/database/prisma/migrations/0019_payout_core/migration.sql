-- PRW-05 vendor-neutral payout core. No provider or bank integration is created here.
CREATE TYPE "WithdrawalStatus_new" AS ENUM ('PENDING','APPROVED','PAYOUT_PENDING','PAYOUT_UNKNOWN','REJECTED','FAILED','PAID','CANCELLED');
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "status" TYPE "WithdrawalStatus_new" USING ("status"::text::"WithdrawalStatus_new");
DROP TYPE "WithdrawalStatus";
ALTER TYPE "WithdrawalStatus_new" RENAME TO "WithdrawalStatus";
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "WithdrawalRequest" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IRR';
ALTER TABLE "WithdrawalRequest" ADD COLUMN "beneficiarySnapshot" JSONB;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "destinationSnapshot" JSONB;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "externalAttemptStarted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "failedAt" TIMESTAMP(3);

CREATE TYPE "PayoutOperationStatus" AS ENUM ('CREATED','PAYOUT_PENDING','PAYOUT_UNKNOWN','FAILED','PAID');
CREATE TYPE "PayoutFeeStatus" AS ENUM ('PENDING','RECOGNIZED','VOID');
CREATE TYPE "PayoutDiscrepancyStatus" AS ENUM ('OPEN','RESOLVED');

CREATE TABLE "PayoutOperation" (
  "id" TEXT NOT NULL,
  "withdrawalId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "PayoutOperationStatus" NOT NULL DEFAULT 'CREATED',
  "providerReference" TEXT,
  "providerStatus" TEXT,
  "amountSnapshot" BIGINT NOT NULL,
  "currencySnapshot" TEXT NOT NULL,
  "beneficiarySnapshot" JSONB NOT NULL,
  "externalAttemptStarted" BOOLEAN NOT NULL DEFAULT false,
  "acceptedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastErrorClass" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayoutOperation_withdrawalId_key" ON "PayoutOperation"("withdrawalId");
CREATE UNIQUE INDEX "PayoutOperation_idempotencyKey_key" ON "PayoutOperation"("idempotencyKey");
CREATE INDEX "PayoutOperation_status_updatedAt_idx" ON "PayoutOperation"("status","updatedAt");
ALTER TABLE "PayoutOperation" ADD CONSTRAINT "PayoutOperation_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayoutFeeEvent" (
  "id" TEXT NOT NULL,
  "payoutOperationId" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "PayoutFeeStatus" NOT NULL DEFAULT 'PENDING',
  "recognizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutFeeEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayoutFeeEvent_payoutOperationId_status_key" ON "PayoutFeeEvent"("payoutOperationId","status");
ALTER TABLE "PayoutFeeEvent" ADD CONSTRAINT "PayoutFeeEvent_payoutOperationId_fkey" FOREIGN KEY ("payoutOperationId") REFERENCES "PayoutOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayoutDiscrepancy" (
  "id" TEXT NOT NULL,
  "payoutOperationId" TEXT NOT NULL,
  "withdrawalId" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "status" "PayoutDiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
  "details" JSONB,
  "resolutionReason" TEXT,
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "PayoutDiscrepancy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayoutDiscrepancy_status_createdAt_idx" ON "PayoutDiscrepancy"("status","createdAt");
CREATE INDEX "PayoutDiscrepancy_withdrawalId_createdAt_idx" ON "PayoutDiscrepancy"("withdrawalId","createdAt");
ALTER TABLE "PayoutDiscrepancy" ADD CONSTRAINT "PayoutDiscrepancy_payoutOperationId_fkey" FOREIGN KEY ("payoutOperationId") REFERENCES "PayoutOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutDiscrepancy" ADD CONSTRAINT "PayoutDiscrepancy_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

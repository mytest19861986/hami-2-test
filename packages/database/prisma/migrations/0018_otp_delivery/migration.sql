CREATE TYPE "OtpDeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'UNKNOWN');

CREATE TABLE "OtpDelivery" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'SMS',
  "status" "OtpDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerKey" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "idempotencyKey" TEXT,
  "semanticHash" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorClass" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtpDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OtpDelivery_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "OtpChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OtpDelivery_providerKey_key" ON "OtpDelivery"("providerKey");
CREATE UNIQUE INDEX "OtpDelivery_idempotencyKey_key" ON "OtpDelivery"("idempotencyKey");
CREATE INDEX "OtpDelivery_challengeId_createdAt_idx" ON "OtpDelivery"("challengeId", "createdAt");
CREATE INDEX "OtpDelivery_status_createdAt_idx" ON "OtpDelivery"("status", "createdAt");

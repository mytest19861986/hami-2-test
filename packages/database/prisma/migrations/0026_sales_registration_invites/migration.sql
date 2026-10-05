CREATE TABLE "SalesRegistrationInvite" (
    "id" TEXT NOT NULL,
    "salesPartnerUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesRegistrationInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesRegistrationInvite_codeHash_key"
    ON "SalesRegistrationInvite"("codeHash");
CREATE INDEX "SalesRegistrationInvite_salesPartnerUserId_createdAt_idx"
    ON "SalesRegistrationInvite"("salesPartnerUserId", "createdAt");
CREATE INDEX "SalesRegistrationInvite_expiresAt_redeemedAt_idx"
    ON "SalesRegistrationInvite"("expiresAt", "redeemedAt");

ALTER TABLE "SalesRegistrationInvite"
    ADD CONSTRAINT "SalesRegistrationInvite_salesPartnerUserId_fkey"
    FOREIGN KEY ("salesPartnerUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Store only a keyed, versioned identity digest; never persist the raw national ID.
ALTER TABLE "DoctorProfile"
  ADD COLUMN "nationalIdHmac" TEXT,
  ADD COLUMN "nationalIdKeyVersion" INTEGER;

CREATE UNIQUE INDEX "DoctorProfile_nationalIdHmac_key"
  ON "DoctorProfile"("nationalIdHmac");

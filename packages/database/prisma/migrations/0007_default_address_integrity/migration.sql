CREATE UNIQUE INDEX IF NOT EXISTS "Address_one_default_per_user" ON "Address"("userId") WHERE "isDefault" = true;

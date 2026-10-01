CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Province_code_key" ON "Province"("code");
CREATE UNIQUE INDEX "City_provinceId_name_key" ON "City"("provinceId", "name");
CREATE INDEX "City_provinceId_idx" ON "City"("provinceId");
ALTER TABLE "Address" ADD COLUMN "provinceId" TEXT;
ALTER TABLE "Address" ADD COLUMN "cityId" TEXT;
INSERT INTO "Province" ("id", "name", "code") VALUES ('dev-tehran', 'تهران', 'THR');
INSERT INTO "City" ("id", "provinceId", "name") VALUES ('dev-tehran-city', 'dev-tehran', 'تهران');
UPDATE "Address" SET "provinceId" = 'dev-tehran', "cityId" = 'dev-tehran-city';
ALTER TABLE "Address" ALTER COLUMN "provinceId" SET NOT NULL;
ALTER TABLE "Address" ALTER COLUMN "cityId" SET NOT NULL;
ALTER TABLE "Address" DROP COLUMN "province";
ALTER TABLE "Address" DROP COLUMN "city";
ALTER TABLE "Address" ADD CONSTRAINT "Address_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "City" ADD CONSTRAINT "City_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

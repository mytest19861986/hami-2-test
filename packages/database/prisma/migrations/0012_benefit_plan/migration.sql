CREATE TYPE "BenefitPlanStatus" AS ENUM ('DRAFT','ACTIVE','INACTIVE','ARCHIVED');
CREATE TYPE "DiscountType" AS ENUM ('PERCENT','FIXED_AMOUNT','OTHER');
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING_PAYMENT','PAID','CANCELLED','REFUNDED');
CREATE TYPE "BenefitMembershipStatus" AS ENUM ('PENDING','ACTIVE','EXPIRED','CANCELLED');
CREATE TABLE "BenefitPlan" ("id" TEXT NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT,"priceAmount" BIGINT NOT NULL,"currency" TEXT NOT NULL,"validityDays" INTEGER NOT NULL,"status" "BenefitPlanStatus" NOT NULL DEFAULT 'DRAFT',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "BenefitPlan_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "BenefitPlan_code_key" ON "BenefitPlan"("code");
CREATE INDEX "BenefitPlan_status_createdAt_idx" ON "BenefitPlan"("status","createdAt");

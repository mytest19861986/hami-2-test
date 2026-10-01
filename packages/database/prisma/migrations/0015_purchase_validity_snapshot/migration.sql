ALTER TABLE "PlanPurchase" ADD COLUMN "validityDaysSnapshot" INTEGER;
UPDATE "PlanPurchase" p SET "validityDaysSnapshot" = b."validityDays" FROM "BenefitPlan" b WHERE b."id" = p."planId" AND p."validityDaysSnapshot" IS NULL;
ALTER TABLE "PlanPurchase" ALTER COLUMN "validityDaysSnapshot" SET NOT NULL;

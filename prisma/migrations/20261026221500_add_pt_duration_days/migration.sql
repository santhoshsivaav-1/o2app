-- AlterTable
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "ptDurationDays" INTEGER NOT NULL DEFAULT 0;
UPDATE "Membership" SET "ptDurationDays" = "ptDurationMonths" * 30 WHERE "ptDurationMonths" > 0 AND "ptDurationDays" = 0;

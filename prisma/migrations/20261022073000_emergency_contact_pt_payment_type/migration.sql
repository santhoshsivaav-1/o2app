-- Emergency contact: structured fields. Legacy free-text emergencyContact is
-- copied into emergName so no data is lost.
ALTER TABLE "Member" ADD COLUMN "emergName" TEXT;
ALTER TABLE "Member" ADD COLUMN "emergMobile" TEXT;
ALTER TABLE "Member" ADD COLUMN "emergAddress" TEXT;
ALTER TABLE "Member" ADD COLUMN "emergRelationship" TEXT;
UPDATE "Member" SET "emergName" = "emergencyContact" WHERE "emergencyContact" IS NOT NULL AND "emergencyContact" <> '';

-- Personal training add-on on memberships.
ALTER TABLE "Membership" ADD COLUMN "ptTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Membership" ADD COLUMN "ptDurationMonths" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Membership" ADD COLUMN "ptStart" DATE;
ALTER TABLE "Membership" ADD COLUMN "ptTrainerId" TEXT;
CREATE INDEX "Membership_ptTrainerId_idx" ON "Membership"("ptTrainerId");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_ptTrainerId_fkey" FOREIGN KEY ("ptTrainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment ledger: payment purpose + free-text notes.
ALTER TABLE "Payment" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'membership';
ALTER TABLE "Payment" ADD COLUMN "notes" TEXT;
CREATE INDEX "Payment_type_idx" ON "Payment"("type");

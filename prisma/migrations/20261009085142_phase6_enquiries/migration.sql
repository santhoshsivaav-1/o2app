-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "enquiryNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNorm" TEXT NOT NULL,
    "email" TEXT,
    "interest" TEXT,
    "interestPackageId" TEXT,
    "source" TEXT,
    "enquiryDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedToId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "convertedMemberId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "note" TEXT,
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_enquiryNo_key" ON "Enquiry"("enquiryNo");

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");

-- CreateIndex
CREATE INDEX "Enquiry_phoneNorm_idx" ON "Enquiry"("phoneNorm");

-- CreateIndex
CREATE INDEX "Enquiry_assignedToId_idx" ON "Enquiry"("assignedToId");

-- CreateIndex
CREATE INDEX "Enquiry_nextFollowUpAt_idx" ON "Enquiry"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Enquiry_enquiryDate_idx" ON "Enquiry"("enquiryDate");

-- CreateIndex
CREATE INDEX "FollowUp_enquiryId_idx" ON "FollowUp"("enquiryId");

-- CreateIndex
CREATE INDEX "FollowUp_dueAt_idx" ON "FollowUp"("dueAt");

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_interestPackageId_fkey" FOREIGN KEY ("interestPackageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_convertedMemberId_fkey" FOREIGN KEY ("convertedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

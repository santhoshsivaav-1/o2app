-- CreateTable
CREATE TABLE "AttendanceDevice" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "apiKeyHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "duplicateWindowMin" INTEGER NOT NULL DEFAULT 5,
    "lastSeenAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceUserMapping" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "memberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceUserMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "deviceEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'device',
    "status" TEXT NOT NULL DEFAULT 'mapped',
    "memberId" TEXT,
    "recordId" TEXT,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'device',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSyncRun" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "ingested" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "unmapped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "DeviceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_deviceCode_key" ON "AttendanceDevice"("deviceCode");

-- CreateIndex
CREATE INDEX "DeviceUserMapping_memberId_idx" ON "DeviceUserMapping"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceUserMapping_deviceId_deviceUserId_key" ON "DeviceUserMapping"("deviceId", "deviceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_dedupeKey_key" ON "AttendanceEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AttendanceEvent_deviceId_idx" ON "AttendanceEvent"("deviceId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_occurredAt_idx" ON "AttendanceEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_deviceUserId_idx" ON "AttendanceEvent"("deviceUserId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_memberId_idx" ON "AttendanceEvent"("memberId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_status_idx" ON "AttendanceEvent"("status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_memberId_idx" ON "AttendanceRecord"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_memberId_date_key" ON "AttendanceRecord"("memberId", "date");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_recordId_idx" ON "AttendanceCorrection"("recordId");

-- CreateIndex
CREATE INDEX "DeviceSyncRun_deviceId_idx" ON "DeviceSyncRun"("deviceId");

-- AddForeignKey
ALTER TABLE "DeviceUserMapping" ADD CONSTRAINT "DeviceUserMapping_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceUserMapping" ADD CONSTRAINT "DeviceUserMapping_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSyncRun" ADD CONSTRAINT "DeviceSyncRun_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

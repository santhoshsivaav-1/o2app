-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

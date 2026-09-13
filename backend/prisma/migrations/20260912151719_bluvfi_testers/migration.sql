-- CreateEnum
CREATE TYPE "TesterRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TesterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

-- CreateTable
CREATE TABLE "TesterUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "xHandle" TEXT,
    "telegramHandle" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "role" "TesterRole" NOT NULL DEFAULT 'USER',
    "status" "TesterStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "selectedAt" TIMESTAMP(3),
    "removedFromSelectedAt" TIMESTAMP(3),
    "removedFromSelectedReason" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TesterUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TesterActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'manual_check_in',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesterActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TesterUser_email_key" ON "TesterUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TesterUser_referralCode_key" ON "TesterUser"("referralCode");

-- CreateIndex
CREATE INDEX "TesterUser_createdAt_idx" ON "TesterUser"("createdAt");

-- CreateIndex
CREATE INDEX "TesterUser_isSelected_status_idx" ON "TesterUser"("isSelected", "status");

-- CreateIndex
CREATE INDEX "TesterUser_referredById_idx" ON "TesterUser"("referredById");

-- CreateIndex
CREATE INDEX "TesterActivity_userId_createdAt_idx" ON "TesterActivity"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TesterUser" ADD CONSTRAINT "TesterUser_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "TesterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TesterActivity" ADD CONSTRAINT "TesterActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TesterUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AirdropStatus" AS ENUM ('UNKNOWN', 'PENDING', 'VERIFIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('UNKNOWN', 'PENDING', 'VERIFIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EmailPlatform" AS ENUM ('TUTANOTA', 'PROTONMAIL', 'GMAIL');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('UNKNOWN', 'PENDING', 'VERIFIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AccountPlatform" AS ENUM ('TWITTER');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('cron', 'date');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('farm', 'task');

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "birthdate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "browser" JSONB,
    "emailId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airdrop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL,
    "metadata" JSONB,
    "walletId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airdrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "mnemonic" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "platform" "EmailPlatform" NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "metadata" JSONB,
    "parentId" TEXT,
    "lastStatusUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "platform" "AccountPlatform" NOT NULL,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL,
    "metadata" JSONB,
    "emailId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSession" (
    "id" TEXT NOT NULL,
    "type" "SessionType" NOT NULL,
    "name" TEXT NOT NULL,
    "spread" INTEGER NOT NULL,
    "chain" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "type" "JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL,
    "jobSessionId" TEXT NOT NULL,
    "failedCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmLog" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entity_emailId_key" ON "Entity"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "Airdrop_walletId_key" ON "Airdrop"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_type_publicKey_key" ON "Wallet"("type", "publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "Email_platform_username_key" ON "Email"("platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Account_platform_emailId_key" ON "Account"("platform", "emailId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmLog_script_entityId_key" ON "FarmLog"("script", "entityId");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Airdrop" ADD CONSTRAINT "Airdrop_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Airdrop" ADD CONSTRAINT "Airdrop_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_jobSessionId_fkey" FOREIGN KEY ("jobSessionId") REFERENCES "JobSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmLog" ADD CONSTRAINT "FarmLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

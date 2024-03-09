-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('EVM');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('UNKNOWN', 'PENDING', 'VERIFIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EmailPlatform" AS ENUM ('TUTANOTA', 'PROTONMAIL', 'GMAIL');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('UNKNOWN', 'PENDING', 'VERIFIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AccountPlatform" AS ENUM ('TWITTER');

-- CreateEnum
CREATE TYPE "AirdropStatus" AS ENUM ('UNKNOWN', 'PENDING', 'VERIFIED', 'BLOCKED');

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "birthdate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "browser" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "type" "WalletType" NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "mnemonic" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "entityId" TEXT NOT NULL,
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
    "status" "EmailStatus" NOT NULL DEFAULT 'UNKNOWN',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "usedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entityId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "platform" "AccountPlatform" NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'UNKNOWN',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "usedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entityId" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airdrop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'UNKNOWN',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airdrop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_entityId_key" ON "Wallet"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_entityId_type_key" ON "Wallet"("entityId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Email_entityId_key" ON "Email"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_entityId_key" ON "Account"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_emailId_key" ON "Account"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_entityId_platform_key" ON "Account"("entityId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "Account_emailId_platform_key" ON "Account"("emailId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "Airdrop_entityId_key" ON "Airdrop"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Airdrop_entityId_name_key" ON "Airdrop"("entityId", "name");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Airdrop" ADD CONSTRAINT "Airdrop_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

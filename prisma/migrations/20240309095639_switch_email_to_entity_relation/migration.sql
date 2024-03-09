/*
  Warnings:

  - You are about to drop the column `entityId` on the `Email` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[emailId]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `emailId` to the `Entity` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_entityId_fkey";

-- DropIndex
DROP INDEX "Email_entityId_key";

-- AlterTable
ALTER TABLE "Email" DROP COLUMN "entityId";

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "emailId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Entity_emailId_key" ON "Entity"("emailId");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TaskState" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EntityTaskState" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'SUCCEEDED');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "TaskState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityTask" (
    "entityId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "state" "EntityTaskState" NOT NULL,

    CONSTRAINT "EntityTask_pkey" PRIMARY KEY ("entityId","taskId")
);

-- AddForeignKey
ALTER TABLE "EntityTask" ADD CONSTRAINT "EntityTask_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityTask" ADD CONSTRAINT "EntityTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

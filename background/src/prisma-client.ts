import { PrismaClient, Task, EntityTask } from "@prisma/client";

const client = new PrismaClient();

export type TaskWithEntities = Task & { entities: EntityTask[] };

export * from "@prisma/client";
export default client;

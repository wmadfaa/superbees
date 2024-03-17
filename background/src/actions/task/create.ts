import * as async from "async";

import * as pm3 from "@superbees/pm3";
import { faker } from "@faker-js/faker";
import { cloneDeep, create, debounce, differenceBy, entries, groupBy, intersectionBy, isEmpty, isNumber, omit, shuffle, throttle } from "lodash";

import cron from "node-cron";
import cParser from "cron-parser";

import db, { EntityTaskState, GeneratorState, TaskState, TaskWithEntities, Prisma } from "../../prisma-client";
import { ScriptHandlers, ScriptsQueueItem } from "../../queues";
import Obj, { ObjSetArgs } from "../../obj";

export interface HandleOnTaskCreateArgs {
  script: string;
  vars: string;
  agents: number;
  runs: number;
  cron: string;
  filter?: string;
}

export function handleOnTaskCreate(
  tasks: Map<string, Obj<TaskWithEntities>>,
  scheduledTasks: Map<string, cron.ScheduledTask>,
  queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.TASK>>,
) {
  pm3.registerAction<HandleOnTaskCreateArgs, unknown>("task:create", async (args) => {
    const task = await db.task.create({ data: { payload: { ...args } }, include: { entities: true } });
    await deployTask(task, tasks, scheduledTasks, args, queue);
  });
}

export function createTask(task: Obj<TaskWithEntities>, args: HandleOnTaskCreateArgs, queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.TASK>>) {
  const timers = new Array<NodeJS.Timeout>();
  const stop = (scheduledTask: cron.ScheduledTask) => () => {
    scheduledTask.stop();
    task.ref.state = GeneratorState.PAUSED;
    task.ref.entities = task.ref.entities.filter((e) => e.state !== EntityTaskState.PENDING);
    timers.forEach((timeout) => clearTimeout(timeout));
  };

  const scheduledTask = cron.schedule(args.cron, async () => {
    if (task.ref.state !== TaskState.ACTIVE) return;

    let entities_filter: Prisma.EntityWhereInput = { NOT: { tasks: { some: { task: { id: task.ref.id } } } } };
    if (!isEmpty(args.filter)) {
      entities_filter = { ...entities_filter, AND: args.filter as any };
    }

    let entities = await db.entity.findMany({
      where: entities_filter,
      select: { id: true },
    });
    if (!entities.length) return;

    const cursor = task.ref.entities.length;
    const max_allowed_agents = Math.min(args.agents, Math.max(0, args.runs - cursor));
    if (max_allowed_agents < 1) return;
    entities = shuffle(entities).slice(0, max_allowed_agents);

    const time_gap = cParser.parseExpression(args.cron).next().getTime() - Date.now();
    const time_chunk = Math.floor(time_gap / max_allowed_agents);

    const spread = [0];
    for (let i = 1; i < max_allowed_agents; i++) {
      let last_point = spread[spread.length - 1];
      spread.push(faker.number.int({ min: last_point, max: last_point + time_chunk * i }));
    }

    const onDone = async () => {
      if (!isNumber(args.runs)) return;
      const executed_tasks_count = task.ref.entities.filter((v) => [EntityTaskState.SUCCEEDED, EntityTaskState.FAILED].some((s) => s === v.state)).length;
      if (args.runs <= executed_tasks_count) {
        stop(scheduledTask);
        task.ref.state = TaskState.COMPLETED;
      }
    };

    for (let i = 0; i < spread.length; i++) {
      const entityId = entities[i].id;
      task.ref.entities = [...task.ref.entities, { taskId: task.ref.id, entityId, state: EntityTaskState.PENDING }];

      timers.push(setTimeout(() => queue.push({ type: ScriptHandlers.TASK, taskId: task.ref.id, entityId, script_name: args.script, script_vars: args.vars, onDone }), spread[i]));
    }
  });

  return create(scheduledTask, { stop: stop(scheduledTask) });
}

export async function reDeployTasks(
  tasks: Map<string, Obj<TaskWithEntities>>,
  scheduledTasks: Map<string, cron.ScheduledTask>,
  queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.TASK>>,
) {
  const tasks_data = await db.task.findMany({ where: { state: { in: [TaskState.ACTIVE, TaskState.PAUSED] } }, include: { entities: true } });

  for (const task of tasks_data) {
    const args = JSON.parse(JSON.stringify(task.payload));
    await deployTask(task, tasks, scheduledTasks, args, queue);
  }
}

async function deployTask(
  task: TaskWithEntities,
  tasks: Map<string, Obj<TaskWithEntities>>,
  scheduledTasks: Map<string, cron.ScheduledTask>,
  args: HandleOnTaskCreateArgs,
  queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.TASK>>,
) {
  const task_obj = new Obj(task);

  const db_queue = async.queue(async ({ item }: { item: ObjSetArgs<TaskWithEntities> }, callback) => {
    try {
      const [target, p, newValue] = cloneDeep(item);
      console.table([Object.fromEntries(entries(groupBy(target.entities, "state")).map(([k, v]) => [k, v.length]))]);

      Reflect.set(target, p, newValue);
      if (p === "state") await db.task.update({ where: { id: task.id }, data: { state: target.state } });
      if (p === "entities") {
        const current = await db.entityTask.findMany({ where: { taskId: task.id } });
        const next = target.entities;

        const deleted = differenceBy(current, next, "entityId");
        if (deleted.length) await db.entityTask.deleteMany({ where: { taskId: task.id, entityId: { in: deleted.map((e) => e.entityId) } } });

        const updated = intersectionBy(next, current, "entityId");
        if (updated.length) {
          await db.$transaction(async (prisma) => {
            for (const r of updated) {
              await prisma.entityTask.update({ where: { entityId_taskId: { taskId: r.taskId, entityId: r.entityId } }, data: { state: r.state } });
            }
          });
        }

        const created = differenceBy(next, current, "entityId").map((o) => omit(o, "taskId"));
        if (created.length) await db.task.update({ where: { id: task.id }, data: { entities: { createMany: { data: created } } } });
      }
      return callback(null);
    } catch (e: any) {
      return callback(e);
    }
  });

  task_obj.subscribe("set", (item) => db_queue.push({ item }));
  tasks.set(task.id, task_obj);
  scheduledTasks.set(task.id, createTask(task_obj, args, queue));
}

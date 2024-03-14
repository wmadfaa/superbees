import type * as async from "async";
import type { ScriptQueueTask } from "../../queues";

import cron from "node-cron";
import cParser from "cron-parser";
import { faker } from "@faker-js/faker";
import { create, isEmpty, isNumber, shuffle } from "lodash";

import * as pm3 from "@superbees/pm3";

import db, { EntityTaskState, Prisma, TaskState } from "../../prisma-client";

export interface HandleOnTaskCreateArgs {
  script: string;
  filter: string;
  vars: string;
  agents: number;
  max_runs: number;
  cron: string;
}

export function handleOnTaskCreate(tasks: Map<string, cron.ScheduledTask>, queue: async.QueueObject<ScriptQueueTask>) {
  pm3.registerAction<HandleOnTaskCreateArgs, unknown>("task:create", async (args, process, logger) => {
    const task = await db.task.create({
      data: { payload: { ...args } },
    });
    tasks.set(task.id, createTask(task.id, args, queue, logger));
  });
}

export function createTask(refID: string, args: HandleOnTaskCreateArgs, queue: async.QueueObject<ScriptQueueTask>, logger: pm3.ActionLogger) {
  const timers = new Array<NodeJS.Timeout>();

  const stop = (cronTask: cron.ScheduledTask) => () => {
    timers.forEach((timeout) => clearTimeout(timeout));
    db.entityTask.deleteMany({ where: { taskId: refID, state: EntityTaskState.PENDING } });
    cronTask.stop();
  };

  const cronTask = cron.schedule(args.cron, async () => {
    const task = await db.task.findUnique({ where: { id: refID } });
    if (task?.state !== TaskState.ACTIVE) return;

    let entities_filter: Prisma.EntityWhereInput = { NOT: { tasks: { some: { task: { id: refID } } } } };
    if (!isEmpty(args.filter)) {
      entities_filter = { ...entities_filter, AND: args.filter as any };
    }

    let entities = await db.entity.findMany({
      where: entities_filter,
      select: { id: true },
    });
    if (!entities.length) return;

    const cursor = (await db.entity.count()) - entities.length;

    const max_allowed_agents = Math.min(args.agents, Math.max(0, args.max_runs - cursor));
    entities = shuffle(entities).slice(0, max_allowed_agents);

    const interval = cParser.parseExpression(args.cron);
    const time_gap = interval.next().getTime() - Date.now();
    const time_chunk = Math.floor(time_gap / max_allowed_agents);

    const spread = [0];
    for (let i = 1; i < max_allowed_agents; i++) {
      let last_point = spread[spread.length - 1];
      spread.push(faker.number.int({ min: last_point, max: last_point + time_chunk * i }));
    }

    const onDone = async () => {
      if (!isNumber(args.max_runs)) return;
      const executed_tasks_count = await db.entityTask.count({ where: { taskId: refID, state: { in: [EntityTaskState.FAILED, EntityTaskState.SUCCEEDED] } } });
      if (args.max_runs >= executed_tasks_count) {
        await db.task.update({ where: { id: refID }, data: { state: TaskState.COMPLETED } });
        stop(cronTask);
        logger.complete();
      }
    };
    for (let i = 0; i <= spread.length; i++) {
      const entityId = entities[i].id;

      await db.entityTask.create({ data: { entityId, taskId: refID, state: EntityTaskState.PENDING } });
      timers.push(
        setTimeout(() => {
          queue.push({ entityId, taskId: refID, script_logger: logger, script_vars: args.vars, script_name: args.script, cursor: cursor + i, onDone });
        }, spread[i]),
      );
    }
  });

  return create(cronTask, { stop: stop(cronTask) });
}

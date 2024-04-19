import type * as async from "async";

import { cloneDeep, create, debounce, isNumber, pick } from "lodash";

import { faker } from "@faker-js/faker";
import cron from "node-cron";
import cParser from "cron-parser";

import * as pm3 from "@superbees/pm3";

import { ScriptHandlers, ScriptsQueueItem } from "../../queues";
import db, { GeneratorState, Generator } from "../../prisma-client";
import Obj, { ObjSetArgs } from "../../obj";

export interface HandleOnGeneratorCreateArgs {
  script: string;
  vars: string;
  agents: number;
  runs: number;
  cron: string;
}
export function handleOnGeneratorCreate(
  generators: Map<string, Obj<Generator>>,
  scheduledTasks: Map<string, cron.ScheduledTask>,
  queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.GENERATOR>>,
) {
  pm3.registerAction<HandleOnGeneratorCreateArgs, unknown>("generator:create", async (args) => {
    const generator = await db.generator.create({ data: { payload: { ...args } } });
    await deployGeneratorScript(generator, generators, scheduledTasks, args, queue);
  });
}

export function createGenerator(generator: Obj<Generator>, args: HandleOnGeneratorCreateArgs, queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.GENERATOR>>) {
  const timers = new Array<NodeJS.Timeout>();
  const stop = (scheduledTask: cron.ScheduledTask) => () => {
    scheduledTask.stop();
    generator.ref.state = GeneratorState.PAUSED;
    generator.ref.pending_runs = 0;
    timers.forEach((timeout) => clearTimeout(timeout));
  };

  const scheduledTask = cron.schedule(args.cron, async () => {
    if (generator.ref.state !== GeneratorState.ACTIVE) return;
    const cursor = generator.ref.pending_runs + generator.ref.running_runs + generator.ref.completed_runs + generator.ref.failed_runs;
    const max_allowed_agents = Math.min(args.agents, Math.max(0, args.runs - cursor));
    if (max_allowed_agents < 1) return;

    const time_gap = cParser.parseExpression(args.cron).next().getTime() - Date.now();
    const time_chunk = Math.floor(time_gap / max_allowed_agents);

    const spread = [0];
    for (let i = 1; i < max_allowed_agents; i++) {
      let last_point = spread[spread.length - 1];
      spread.push(faker.number.int({ min: last_point, max: last_point + time_chunk * i }));
    }

    const onDone = async () => {
      if (!isNumber(args.runs)) return;
      const cursor = generator.ref.pending_runs + generator.ref.running_runs + generator.ref.completed_runs + generator.ref.failed_runs;
      if (args.runs <= cursor) {
        stop(scheduledTask);
        generator.ref.state = GeneratorState.COMPLETED;
      }
    };

    for (let i = 0; i < spread.length; i++) {
      generator.ref.pending_runs += 1;

      timers.push(
        setTimeout(
          () => queue.push({ type: ScriptHandlers.GENERATOR, cursor: cursor + i, generatorId: generator.ref.id, script_name: args.script, script_vars: args.vars, onDone }),
          spread[i],
        ),
      );
    }
  });

  return create(scheduledTask, { stop: stop(scheduledTask) });
}

export async function reDeployGenerators(
  generators: Map<string, Obj<Generator>>,
  scheduledTasks: Map<string, cron.ScheduledTask>,
  queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.GENERATOR>>,
) {
  const generators_data = await db.generator.findMany({ where: { state: { in: [GeneratorState.ACTIVE, GeneratorState.PAUSED] } } });
  console.log({ generators_data });
  for (const generator of generators_data) {
    const args = JSON.parse(JSON.stringify(generator.payload));
    await deployGeneratorScript(generator, generators, scheduledTasks, args, queue);
  }
}

async function deployGeneratorScript(
  generator: Generator,
  generators: Map<string, Obj<Generator>>,
  scheduledTasks: Map<string, cron.ScheduledTask>,
  args: HandleOnGeneratorCreateArgs,
  queue: async.QueueObject<ScriptsQueueItem<ScriptHandlers.GENERATOR>>,
) {
  const generator_obj = new Obj(generator);

  const observer = debounce(async (args: ObjSetArgs<Generator>) => {
    const [target, p, newValue] = cloneDeep(args);
    Reflect.set(target, p, newValue);
    const { state, pending_runs, running_runs, completed_runs, failed_runs } = target;
    await db.generator.update({ where: { id: generator.id }, data: { state, pending_runs, running_runs, completed_runs, failed_runs } });
  });

  generator_obj.subscribe("set", observer);
  generators.set(generator.id, generator_obj);
  scheduledTasks.set(generator.id, createGenerator(generator_obj, args, queue));
}

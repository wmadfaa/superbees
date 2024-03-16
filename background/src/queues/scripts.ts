import * as async from "async";
import { ActionLogger } from "@superbees/pm3";
import { SuperbeesScriptFunctionOptions } from "@superbees/script";
import { runScript, runScriptUtil } from "@superbees/script/src/run";

import db, { EntityTaskState, Generator } from "../prisma-client";
import Obj from "../obj";
import Logger from "@superbees/logger";
import logger from "@superbees/logger";

export interface ScriptQueueTask {
  generatorId: string;
  cursor: number;
  script_name: string;
  script_vars?: any;
  onDone(): Promise<void>;
}
export function registerScriptsQueue<T = unknown>(generators: Map<string, Obj<Generator>>, options: Omit<SuperbeesScriptFunctionOptions<T>, "vars" | "util" | "logger">) {
  return async.queue<ScriptQueueTask>(async (item, callback) => {
    const generator = generators.get(item.generatorId)!;
    try {
      generator.ref.pending_runs -= 1;
      generator.ref.running_runs += 1;
      await runScript(item.script_name, { ...options, util: runScriptUtil, vars: item.script_vars, logger: Logger });

      generator.ref.running_runs -= 1;
      generator.ref.completed_runs += 1;

      return callback(null);
    } catch (reason: any) {
      logger.error(reason);
      generator.ref.running_runs -= 1;
      generator.ref.failed_runs += 1;
      return callback(reason);
    } finally {
      await item.onDone();
    }
  }, 10);
}

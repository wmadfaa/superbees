import * as async from "async";
import { ActionLogger } from "@superbees/pm3";
import { SuperbeesScriptFunctionOptions } from "@superbees/script";
import { runScript, runScriptUtil } from "@superbees/script/src/run";

import db, { EntityTaskState } from "../prisma-client";

export interface ScriptQueueTask {
  entityId: string;
  taskId: string;
  cursor: number;

  script_name: string;
  script_vars?: any;
  script_logger: ActionLogger;

  onDone(): Promise<void>;
}
export function registerScriptsQueue<T = unknown>(options: Omit<SuperbeesScriptFunctionOptions<T>, "vars" | "util" | "logger">) {
  return async.queue<ScriptQueueTask>(async (item, callback) => {
    const updateState = async (state: EntityTaskState) => {
      await db.entityTask.update({
        where: { entityId_taskId: { taskId: item.taskId, entityId: item.entityId } },
        data: { state },
      });
    };

    try {
      await updateState(EntityTaskState.RUNNING);
      await runScript(item.script_name, { ...options, util: runScriptUtil, vars: item.script_vars, logger: item.script_logger, entityId: item.entityId });
      await updateState(EntityTaskState.SUCCEEDED);
      return callback(null);
    } catch (reason: any) {
      await updateState(EntityTaskState.FAILED);
      item.script_logger.error(reason, true);
      return callback(reason);
    } finally {
      await item.onDone();
    }
  }, 10);
}

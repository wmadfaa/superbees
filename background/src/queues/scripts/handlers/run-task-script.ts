import logger from "@superbees/logger";

import { runScript, runScriptUtil } from "@superbees/script/src/run";

import { ExecutionQueueHandlerArgs, ScriptHandlers } from "../types";
import { EntityTaskState } from "../../../prisma-client";

export interface RunTaskScriptQueueItem {
  type: ScriptHandlers.TASK;
  taskId: string;

  entityId: string;
  script_name: string;
  script_vars?: any;
  onDone(): Promise<void>;
}

async function runTaskScript(item: RunTaskScriptQueueItem, opts: ExecutionQueueHandlerArgs) {
  const { tasks, ...script_opts } = opts;
  const task = tasks.get(item.taskId)!;

  const updateTaskEntityState = (state: EntityTaskState) => {
    const index = task.ref.entities.findIndex((e) => e.entityId === item.entityId);
    const copy = task.ref.entities.slice();
    copy.splice(index, 1, { ...copy[index], state });
    task.ref.entities = copy;
  };

  try {
    updateTaskEntityState(EntityTaskState.RUNNING);
    await runScript(item.script_name, { ...script_opts, util: runScriptUtil, vars: item.script_vars, logger });
    updateTaskEntityState(EntityTaskState.SUCCEEDED);
  } catch (reason: any) {
    updateTaskEntityState(EntityTaskState.FAILED);
    logger.error(reason);
    throw reason;
  } finally {
    await item.onDone();
  }
}

export default runTaskScript;

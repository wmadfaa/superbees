import logger from "@superbees/logger";

import { runScript, runScriptUtil } from "@superbees/script/src/run";

import { ExecutionQueueHandlerArgs, ScriptHandlers } from "../types";

export interface RunGeneratorScriptQueueItem {
  type: ScriptHandlers.GENERATOR;
  generatorId: string;
  cursor: number;
  script_name: string;
  script_vars?: any;
  onDone(): Promise<void>;
}

async function runGeneratorScript(item: RunGeneratorScriptQueueItem, opts: ExecutionQueueHandlerArgs) {
  const { generators, ...script_opts } = opts;

  const generator = generators.get(item.generatorId)!;
  try {
    generator.ref.pending_runs -= 1;
    generator.ref.running_runs += 1;
    await runScript(item.script_name, { ...script_opts, util: runScriptUtil, vars: item.script_vars, logger });

    generator.ref.running_runs -= 1;
    generator.ref.completed_runs += 1;
  } catch (reason: any) {
    logger.error(reason);
    generator.ref.running_runs -= 1;
    generator.ref.failed_runs += 1;
    throw reason;
  } finally {
    await item.onDone();
  }
}

export default runGeneratorScript;

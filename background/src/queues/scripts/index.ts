import * as async from "async";

import { ExecutionQueueHandlerArgs, ScriptHandlers } from "./types";

import runGeneratorScript, { RunGeneratorScriptQueueItem } from "./handlers/run-generator-script";
import runTaskScript, { RunTaskScriptQueueItem } from "./handlers/run-task-script";

const mapTypes2Handlers = {
  [ScriptHandlers.GENERATOR]: runGeneratorScript,
  [ScriptHandlers.TASK]: runTaskScript,
};

interface MapTypes2HandlerItems {
  [ScriptHandlers.GENERATOR]: RunGeneratorScriptQueueItem;
  [ScriptHandlers.TASK]: RunTaskScriptQueueItem;
}

export type ScriptsQueueItem<T extends ScriptHandlers> = MapTypes2HandlerItems[T];

export function registerScriptsQueue<T extends ScriptHandlers, I extends ScriptsQueueItem<T>>(opts: ExecutionQueueHandlerArgs) {
  return async.queue<I>(async (item, callback) => {
    // @ts-expect-error
    await mapTypes2Handlers[item.type](item, opts).then(
      () => callback(null),
      (reason) => callback(reason),
    );
  });
}

export * from "./types";
export type * from "./handlers/run-generator-script";

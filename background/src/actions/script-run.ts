import { extend } from "lodash";

import * as pm3 from "@superbees/pm3";
import logger from "@superbees/logger";

import { SuperbeesScriptFunctionOptions } from "@superbees/script/src/types";
import { runScript, runScriptUtil } from "@superbees/script/src/run";

export interface HandleOnScriptRunArgs {
  name: string;
  vars: Record<string, unknown>;
}

export function handleOnScriptRun<T = unknown>(options: Omit<SuperbeesScriptFunctionOptions<T>, "vars" | "util" | "logger">) {
  pm3.registerAction<HandleOnScriptRunArgs, unknown>("script:run", async ({ name, vars }, process) => {
    const childLogger = logger.child({ tag: `(cli) script:run['${name}']`, vars });

    const mixedLogger = extend({}, childLogger, {
      start: () => {
        childLogger.info(`starting`);
        process.send(`starting`, true);
      },
      info: (msg: string, ...args: any[]) => {
        childLogger.info(msg, args);
        process.send(msg);
      },
      warn: (msg: string, ...args: any[]) => {
        childLogger.warn(msg, args);
        process.send(msg);
      },
      error: (msg: string, ...args: any[]) => {
        childLogger.error(msg, args);
        process.error(msg);
      },
      complete: () => {
        childLogger.info(`completed`);
        process.send(`completed`, false);
      },
    });

    mixedLogger.start();
    await runScript(name, { ...options, util: runScriptUtil, vars, logger: mixedLogger }).then(
      () => mixedLogger.complete(),
      (reason) => mixedLogger.error(reason),
    );
  });
}

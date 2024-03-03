import * as pm3 from "@superbees/pm3";

import { SuperbeesScriptFunctionOptions } from "@superbees/script/src/types";
import { runScript, runScriptUtil } from "@superbees/script/src/run";

export interface HandleOnScriptRunArgs {
  name: string;
  vars: Record<string, unknown>;
}

export function handleOnScriptRun<T = unknown>(options: Omit<SuperbeesScriptFunctionOptions<T>, "vars" | "util">) {
  pm3.registerAction<HandleOnScriptRunArgs, unknown>("script:run", async ({ name, vars }, process) => {
    process.send(`starting ${name} script...`);
    await runScript(name, { ...options, util: runScriptUtil, vars }).then(
      () => process.complete(),
      (reason) => process.error(reason),
    );
  });
}

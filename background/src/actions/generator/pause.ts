import Obj from "../../obj";
import { Generator, GeneratorState } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";

export interface HandleOnGeneratorPauseArgs {
  script?: string;
  generatorId?: string;
}

export function handleOnGeneratorPause(generators: Map<string, Obj<Generator>>) {
  pm3.registerAction<HandleOnGeneratorPauseArgs, unknown>("generator:pause", async ({ generatorId, script }, process) => {
    generators.forEach((obj, id) => {
      const apply_to_all_cond = !generatorId && !script && obj.ref.state === GeneratorState.ACTIVE;
      const apply_to_script_cond = (obj.ref.payload as any).script === script;
      const apply_to_id_cond = id === generatorId;

      if (apply_to_all_cond || apply_to_script_cond || apply_to_id_cond) {
        obj.ref.state = GeneratorState.PAUSED;
        process.send(id);
      }
    });

    process.complete();
  });
}

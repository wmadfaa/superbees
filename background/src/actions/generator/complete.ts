import Obj from "../../obj";
import { Generator, GeneratorState } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";
import { promisify } from "node:util";

export interface HandleOnGeneratorCompleteArgs {
  script?: string;
  generatorId?: string;
}

export function handleOnGeneratorComplete(generators: Map<string, Obj<Generator>>) {
  pm3.registerAction<HandleOnGeneratorCompleteArgs, unknown>("generator:complete", async ({ generatorId, script }, process) => {
    for (const [id, obj] of generators) {
      await promisify(setTimeout)(100);
      const apply_to_all_cond = !generatorId && !script && obj.ref.state === GeneratorState.ACTIVE;
      const apply_to_script_cond = (obj.ref.payload as any).script === script;
      const apply_to_id_cond = id === generatorId;

      if (apply_to_all_cond || apply_to_script_cond || apply_to_id_cond) {
        const prev = obj.ref.state;
        obj.ref.state = GeneratorState.COMPLETED;
        process.send({ id, script, prev, generator: obj.ref });
      }
    }
    process.complete();
  });
}

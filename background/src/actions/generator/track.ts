import Obj, { ObjSetArgs } from "../../obj";
import { Generator, GeneratorState } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";
import { cloneDeep, debounce, pick } from "lodash";

export interface HandleOnGeneratorTrackArgs {
  script?: string;
  generatorId?: string;
}

export function handleOnGeneratorTrack(generators: Map<string, Obj<Generator>>) {
  pm3.registerAction<HandleOnGeneratorTrackArgs, unknown>("generator:track", async ({ generatorId, script }, process) => {
    const observer = debounce(async (args: ObjSetArgs<Generator>) => {
      const [target, p, newValue] = cloneDeep(args);
      Reflect.set(target, p, newValue);
      process.send(pick(target, "state", "pending_runs", "running_runs", "completed_runs", "failed_runs"));
    });

    generators.forEach((obj, id) => {
      const apply_to_all_cond = !generatorId && !script && obj.ref.state === GeneratorState.ACTIVE;
      const apply_to_script_cond = (obj.ref.payload as any).script === script;
      const apply_to_id_cond = id === generatorId;

      if (apply_to_all_cond || apply_to_script_cond || apply_to_id_cond) {
        obj.subscribe("set", observer);
      }
    });
  });
}

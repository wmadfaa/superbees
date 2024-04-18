import Obj from "../../obj";
import { Generator, GeneratorState } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";
import { promisify } from "node:util";

export interface HandleOnGeneratorListArgs {
  script?: string;
  status?: string;
}

export function handleOnGeneratorList(generators: Map<string, Obj<Generator>>) {
  pm3.registerAction<HandleOnGeneratorListArgs, unknown>("generator:list", async (args, process) => {
    for (const [k, g] of generators) {
      await promisify(setTimeout)(100);
      if (![GeneratorState.ACTIVE, GeneratorState.PAUSED].some((v) => v === g.ref.state)) continue;
      if ((!args.status && !args.script) || (args.script && (g.ref.payload as any).script === args.script) || (args.status && g.ref.state === args.status)) {
        process.send([k, g.ref], true);
      }
    }

    process.complete();
  });
}

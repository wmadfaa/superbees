import Obj from "../../obj";
import { Generator, GeneratorState } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";

export interface HandleOnGeneratorListArgs {
  script?: string;
  status?: string;
}

export function handleOnGeneratorList(generators: Map<string, Obj<Generator>>) {
  pm3.registerAction<HandleOnGeneratorListArgs, unknown>("generator:list", async (args, process) => {
    generators.forEach((g, k) => {
      if (![GeneratorState.ACTIVE, GeneratorState.PAUSED].some((v) => v === g.ref.state)) return;
      if ((args.script && (g.ref.payload as any).script === args.script) || (args.status && g.ref.state === args.status)) {
        process.send([k, g], true);
      }
    });
    process.complete();
  });
}

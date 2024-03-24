import Obj from "../../obj";
import { TaskState, TaskWithEntities } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";

export interface HandleOnTaskListArgs {
  script?: string;
  status?: string;
}

export function handleOnTaskList(tasks: Map<string, Obj<TaskWithEntities>>) {
  pm3.registerAction<HandleOnTaskListArgs, unknown>("task:list", async (args, process) => {
    tasks.forEach((g, k) => {
      if (![TaskState.ACTIVE, TaskState.PAUSED].some((v) => v === g.ref.state)) return;
      if ((args.script && (g.ref.payload as any).script === args.script) || (args.status && g.ref.state === args.status)) {
        process.send([k, g], true);
      }
    });
    process.complete();
  });
}

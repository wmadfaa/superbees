import Obj from "../../obj";
import { TaskState, TaskWithEntities } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";

export interface HandleOnTaskCompleteArgs {
  script?: string;
  taskId?: string;
}

export function handleOnTaskComplete(tasks: Map<string, Obj<TaskWithEntities>>) {
  pm3.registerAction<HandleOnTaskCompleteArgs, unknown>("task:complete", async ({ taskId, script }, process) => {
    tasks.forEach((obj, id) => {
      const apply_to_all_cond = !taskId && !script && obj.ref.state === TaskState.ACTIVE;
      const apply_to_script_cond = (obj.ref.payload as any).script === script;
      const apply_to_id_cond = id === taskId;

      if (apply_to_all_cond || apply_to_script_cond || apply_to_id_cond) {
        obj.ref.state = TaskState.COMPLETED;
        process.send(id);
      }
    });

    process.complete();
  });
}

import Obj, { ObjSetArgs } from "../../obj";
import { TaskState, TaskWithEntities } from "../../prisma-client";

import * as pm3 from "@superbees/pm3";
import { cloneDeep, debounce, pick } from "lodash";

export interface HandleOnTaskTrackArgs {
  script?: string;
  taskId?: string;
}

export function handleOnTaskTrack(tasks: Map<string, Obj<TaskWithEntities>>) {
  pm3.registerAction<HandleOnTaskTrackArgs, unknown>("task:track", async ({ taskId, script }, process) => {
    const observer = debounce(async (args: ObjSetArgs<TaskWithEntities>) => {
      const [target, p, newValue] = cloneDeep(args);
      Reflect.set(target, p, newValue);
      process.send(pick(target, "state", "pending_runs", "running_runs", "completed_runs", "failed_runs"));
    });

    tasks.forEach((obj, id) => {
      const apply_to_all_cond = !taskId && !script && obj.ref.state === TaskState.ACTIVE;
      const apply_to_script_cond = (obj.ref.payload as any).script === script;
      const apply_to_id_cond = id === taskId;

      if (apply_to_all_cond || apply_to_script_cond || apply_to_id_cond) {
        obj.subscribe("set", observer);
      }
    });
  });
}

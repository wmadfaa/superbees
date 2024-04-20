import type * as yargs from "yargs";
import type * as actions from "@superbees/background/src/actions";

import { isNumber } from "lodash";
import * as pm3 from "@superbees/pm3";

import * as constants from "../../helpers/constants";
import cliProgress from "cli-progress";
import { EntityTaskState } from "@prisma/client";

class TaskTrack implements yargs.CommandModule<unknown, actions.HandleOnTaskTrackArgs> {
  public command = `task:track <id>`;
  public describe = "track some or all tasks";

  public builder(yargs: yargs.Argv) {
    return yargs
      .positional("taskId", {
        describe: "filter by id",
        type: "string",
      })
      .option("script", {
        alias: ["s"],
        describe: "filter by script",
        type: "string",
      })
      .help() as yargs.Argv<actions.HandleOnTaskTrackArgs>;
  }

  public async handler(args: actions.HandleOnTaskTrackArgs) {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!isNumber(background_process?.pm_id)) return console.error(`"${constants.BACKGROUND_PROCESS_NAME}" not found!`);

    try {
      const response = await pm3.sendRequestToProcess(background_process.pm_id, {
        type: "process:msg",
        data: args,
        topic: "task:track",
      });

      const bars = new cliProgress.MultiBar({ clearOnComplete: false, hideCursor: true });
      let total_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let failed_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let completed_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let running_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let pending_runs_bar: cliProgress.SingleBar | undefined = undefined;

      for await (const message of response.createIterableResponseStream()) {
        if ("data" in message) {
          const { payload, entities } = message.data as any;

          const stats = entities.reduce(
            (p: any, c: any) => {
              switch (c.state) {
                case EntityTaskState.FAILED: {
                  p.failed_runs += 1;
                  break;
                }
                case EntityTaskState.RUNNING: {
                  p.running_runs += 1;
                  break;
                }
                case EntityTaskState.PENDING: {
                  p.pending_runs += 1;
                  break;
                }
                case EntityTaskState.SUCCEEDED: {
                  p.completed_runs += 1;
                  break;
                }
              }
              return p;
            },
            {
              failed_runs: 0,
              completed_runs: 0,
              running_runs: 0,
              pending_runs: 0,
            },
          );

          if (!total_runs_bar) total_runs_bar = bars.create(payload.runs, stats.completed_runs + stats.failed_runs, {}, { format: " {bar} | total | {value}/{total}" });
          else total_runs_bar.update(stats.completed_runs + stats.failed_runs);
          if (!pending_runs_bar) pending_runs_bar = bars.create(payload.runs, stats.pending_runs, {}, { format: " {bar} | pending | {value}/{total}" });
          else pending_runs_bar.update(stats.pending_runs);
          if (!running_runs_bar) running_runs_bar = bars.create(payload.runs, stats.running_runs, {}, { format: " {bar} | running | {value}/{total}" });
          else running_runs_bar.update(stats.running_runs);
          if (!completed_runs_bar) completed_runs_bar = bars.create(payload.runs, stats.completed_runs, {}, { format: " {bar} | completed | {value}/{total}" });
          else completed_runs_bar.update(stats.completed_runs);
          if (!failed_runs_bar) failed_runs_bar = bars.create(payload.runs, stats.failed_runs, {}, { format: " {bar} | failed | {value}/{total}" });
          else failed_runs_bar.update(stats.failed_runs);
        }
      }
    } catch (err) {
      console.error(err);
    }

    await pm3.disconnect();
  }
}

export default new TaskTrack();

import type * as yargs from "yargs";
import type * as actions from "@superbees/background/src/actions";

import { isNumber } from "lodash";
import * as pm3 from "@superbees/pm3";
import cliProgress from "cli-progress";

import * as constants from "../../helpers/constants";

class GeneratorTrack implements yargs.CommandModule<unknown, actions.HandleOnGeneratorTrackArgs> {
  public command = `generator:track <generatorId>`;
  public describe = "track some or all generators";

  public builder(yargs: yargs.Argv) {
    return yargs
      .positional("generatorId", {
        describe: "filter by id",
        type: "string",
      })
      .option("script", {
        alias: ["s"],
        describe: "filter by script",
        type: "string",
      })
      .help() as yargs.Argv<actions.HandleOnGeneratorTrackArgs>;
  }

  public async handler(args: actions.HandleOnGeneratorTrackArgs) {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!isNumber(background_process?.pm_id)) return console.error(`"${constants.BACKGROUND_PROCESS_NAME}" not found!`);

    try {
      const response = await pm3.sendRequestToProcess(background_process.pm_id, {
        type: "process:msg",
        data: args,
        topic: "generator:track",
      });

      const bars = new cliProgress.MultiBar({ clearOnComplete: false, hideCursor: true });
      let total_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let failed_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let completed_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let running_runs_bar: cliProgress.SingleBar | undefined = undefined;
      let pending_runs_bar: cliProgress.SingleBar | undefined = undefined;

      for await (const message of response.createIterableResponseStream()) {
        if ("data" in message) {
          const { payload, failed_runs, completed_runs, running_runs, pending_runs } = message.data as any;

          if (!total_runs_bar) total_runs_bar = bars.create(payload.runs, completed_runs + failed_runs, {}, { format: " {bar} | total | {value}/{total}" });
          else total_runs_bar.update(completed_runs + failed_runs);
          if (!pending_runs_bar) pending_runs_bar = bars.create(payload.runs, pending_runs, {}, { format: " {bar} | pending | {value}/{total}" });
          else pending_runs_bar.update(pending_runs);
          if (!running_runs_bar) running_runs_bar = bars.create(payload.runs, running_runs, {}, { format: " {bar} | running | {value}/{total}" });
          else running_runs_bar.update(running_runs);
          if (!completed_runs_bar) completed_runs_bar = bars.create(payload.runs, completed_runs, {}, { format: " {bar} | completed | {value}/{total}" });
          else completed_runs_bar.update(completed_runs);
          if (!failed_runs_bar) failed_runs_bar = bars.create(payload.runs, failed_runs, {}, { format: " {bar} | failed | {value}/{total}" });
          else failed_runs_bar.update(failed_runs);
        }
      }
    } catch (err) {
      console.error(err);
    }

    await pm3.disconnect();
  }
}

export default new GeneratorTrack();

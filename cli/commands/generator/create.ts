import type * as yargs from "yargs";
import type * as actions from "@superbees/background/src/actions";

import { isNumber } from "lodash";
import * as pm3 from "@superbees/pm3";

import * as constants from "../../helpers/constants";

class GeneratorCreate implements yargs.CommandModule<unknown, actions.HandleOnGeneratorCreateArgs> {
  public command = `generator:create <script>`;
  public describe = "create a generator runner";

  public builder(yargs: yargs.Argv) {
    return yargs
      .positional("script", {
        describe: "Name of the script folder in the scripts dir",
        type: "string",
        demandOption: true,
      })
      .option("vars", {
        alias: ["v"],
        describe: "Script vars will be passed with the options object in the script main function",
        type: "string",
        coerce: JSON.parse,
        default: "{}",
      })
      .option("agents", {
        alias: ["a"],
        describe: "number of agents that will concurrently execute the script on each interval",
        type: "number",
        default: 1,
      })
      .option("runs", {
        describe: "total max executions count",
        type: "number",
        default: Number.MAX_SAFE_INTEGER,
      })
      .option("cron", {
        describe: "cron pattern to schedule the executions of the task",
        type: "string",
        default: `* * * * * *`,
      })
      .help() as yargs.Argv<actions.HandleOnGeneratorCreateArgs>;
  }

  public async handler(args: actions.HandleOnGeneratorCreateArgs) {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!isNumber(background_process?.pm_id)) return console.error(`"${constants.BACKGROUND_PROCESS_NAME}" not found!`);
    await pm3.sendRequestToProcess(background_process.pm_id, { type: "process:msg", data: args, topic: "generator:create" });
    await pm3.disconnect();
  }
}

export default new GeneratorCreate();

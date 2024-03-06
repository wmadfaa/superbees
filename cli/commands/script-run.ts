import type * as yargs from "yargs";
import type * as actions from "@superbees/background/src/actions";

import { isNumber } from "lodash";
import * as pm3 from "@superbees/pm3";

import * as constants from "../helpers/constants";

class StartCommand implements yargs.CommandModule<unknown, actions.HandleOnScriptRunArgs> {
  public command = "script:run <name> [args]";
  public describe = "run a farming script";

  public builder(yargs: yargs.Argv) {
    return yargs
      .positional("name", {
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
      .help() as yargs.Argv<actions.HandleOnScriptRunArgs>;
  }

  public async handler(args: actions.HandleOnScriptRunArgs) {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!isNumber(background_process?.pm_id)) return console.error(`"${constants.BACKGROUND_PROCESS_NAME}" not found!`);

    try {
      const response = await pm3.sendRequestToProcess(background_process.pm_id, {
        type: "process:msg",
        data: args,
        topic: "script:run",
      });

      for await (const message of response.createIterableResponseStream()) {
        if ("data" in message) console.log(message.data);
      }
    } catch (err) {
      console.error(err);
    }

    await pm3.disconnect();
  }
}

export default new StartCommand();

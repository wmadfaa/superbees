import type * as yargs from "yargs";
import type * as actions from "@superbees/background/src/actions";

import { isNumber } from "lodash";
import * as pm3 from "@superbees/pm3";

import * as constants from "../../helpers/constants";

class TaskComplete implements yargs.CommandModule<unknown, actions.HandleOnTaskCompleteArgs> {
  public command = `task:complete <id>`;
  public describe = "stop some or all tasks";

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
      .help() as yargs.Argv<actions.HandleOnTaskCompleteArgs>;
  }

  public async handler(args: actions.HandleOnTaskCompleteArgs) {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!isNumber(background_process?.pm_id)) return console.error(`"${constants.BACKGROUND_PROCESS_NAME}" not found!`);

    try {
      const response = await pm3.sendRequestToProcess(background_process.pm_id, {
        type: "process:msg",
        data: args,
        topic: "task:complete",
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

export default new TaskComplete();

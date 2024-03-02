import type * as yargs from "yargs";

import { isNumber } from "lodash";

import * as pm3 from "@superbees/pm3";

import * as constants from "../helpers/constants";

class StartCommand implements yargs.CommandModule {
  public command = "script:run <name> [args]";
  public describe = "run a script main function";

  public async handler() {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!isNumber(background_process?.pm_id)) {
      console.error(`"${constants.BACKGROUND_PROCESS_NAME}" not found!`);
      return;
    }

    await pm3.sendDataToProcessId(background_process.pm_id, {
      type: "process:msg",
      data: { some: "stuff" },
      topic: "cli:command",
    });

    try {
      for await (const message of pm3.createIterableMessageStream((m) => m.raw.payload.topic === "cli:command")) {
        console.log("Received message:", message);
      }
      console.log("No more messages, stream ended.");
    } catch (err) {
      console.error("Error while processing messages:", err);
    }

    await pm3.disconnect();
  }
}

export default new StartCommand();

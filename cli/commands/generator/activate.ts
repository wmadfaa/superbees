import type * as yargs from "yargs";
import type * as actions from "@superbees/background/src/actions";

import { isNumber } from "lodash";
import * as pm3 from "@superbees/pm3";

import * as constants from "../../helpers/constants";

class GeneratorActivate implements yargs.CommandModule<unknown, actions.HandleOnGeneratorActivateArgs> {
  public command = `generator:activate <generatorId>`;
  public describe = "activate some or all generators";

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
      .help() as yargs.Argv<actions.HandleOnGeneratorActivateArgs>;
  }

  public async handler(args: actions.HandleOnGeneratorActivateArgs) {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!isNumber(background_process?.pm_id)) return console.error(`"${constants.BACKGROUND_PROCESS_NAME}" not found!`);

    try {
      const response = await pm3.sendRequestToProcess(background_process.pm_id, {
        type: "process:msg",
        data: args,
        topic: "generator:activate",
      });

      for await (const message of response.createIterableResponseStream()) {
        if ("data" in message) {
          const { id, prev, generator } = message.data as any;
          console.log(`${id} | ${generator.payload.script}: [ ${prev} → ${generator.state} ]`);
        }
      }
    } catch (err) {
      console.error(err);
    }

    await pm3.disconnect();
  }
}

export default new GeneratorActivate();

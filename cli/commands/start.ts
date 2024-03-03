import type * as yargs from "yargs";

import path from "path";
import * as child_process from "child_process";

import dotenv from "@superbees/dotenv";
import * as pm3 from "@superbees/pm3";

import * as constants from "../helpers/constants";

class StartCommand implements yargs.CommandModule {
  public command = "start";
  public describe = "Start the background process";

  public async handler() {
    await pm3.connect();
    const background_process = await pm3.find_process((p) => p.name === constants.BACKGROUND_PROCESS_NAME);
    if (!background_process) {
      const script_path = path.dirname(require.resolve("@superbees/background"));
      await pm3.start({
        env: dotenv,
        wait_ready: true,
        script: script_path,
        name: constants.BACKGROUND_PROCESS_NAME,
        interpreter: child_process.execSync("which ts-node", { encoding: "utf8" }).trim(),
        interpreter_args: `-P ${path.join(script_path, "tsconfig.json")}`,
      });
    }
    await pm3.disconnect();

    console.log(constants.BACKGROUND_PROCESS_NAME);
  }
}

export default new StartCommand();

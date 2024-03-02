import type * as yargs from "yargs";

import * as child_process from "child_process";
import * as util from "util";

import pm2 from "pm2";

import dotenv from "@superbees/dotenv";

import * as constants from "../helpers/constants";

class StartCommand implements yargs.CommandModule {
  public command = "start";
  public describe = "Start the background process";

  public async handler() {
    await util.promisify(pm2.connect).bind(pm2)();
    const apps = await util.promisify<pm2.ProcessDescription[]>(pm2.list).bind(pm2)();

    if (!apps.find((app) => app.name === constants.BACKGROUND_PROCESS_NAME)) {
      await util.promisify<pm2.StartOptions>(pm2.start).bind(pm2)({
        env: dotenv,
        name: constants.BACKGROUND_PROCESS_NAME,
        script: require.resolve("@superbees/background"),
        interpreter: child_process.execSync("which ts-node", { encoding: "utf8" }).trim(),
        wait_ready: true,
      });
    }
    await util.promisify(pm2.disconnect).bind(pm2)();
    console.log(constants.BACKGROUND_PROCESS_NAME);
  }
}

export default new StartCommand();

import cron from "node-cron";

import SuperbeesBrowser from "@superbees/browser";
import SuperbeesUncaptcha from "@superbees/uncaptcha";
import SuperbeesProxy from "@superbees/proxy";

import db from "./src/prisma-client";
import credentials from "../.credentials.json";

import * as queues from "./src/queues";
import * as actions from "./src/actions";

const tasks = new Map<string, cron.ScheduledTask>();

(async () => {
  const browser = new SuperbeesBrowser({
    chromium: { headless: false },
    firefox: { headless: false },
  });
  const uncaptcha = new SuperbeesUncaptcha(credentials["captcha-solvers"]);
  const proxy = new SuperbeesProxy(credentials["proxy-services"]);

  const queue = queues.registerScriptsQueue({ browser, uncaptcha, proxy, prisma: db });

  actions.handleOnScriptRun({ browser, uncaptcha, proxy, prisma: db });

  actions.handleOnTaskCreate(tasks, queue);

  process.send?.(`ready`);
})();

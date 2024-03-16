import cron from "node-cron";

import SuperbeesBrowser from "@superbees/browser";
import SuperbeesUncaptcha from "@superbees/uncaptcha";
import SuperbeesProxy from "@superbees/proxy";

import db, { Generator, TaskWithEntities } from "./src/prisma-client";
import credentials from "../.credentials.json";

import * as queues from "./src/queues";
import * as actions from "./src/actions";
import Obj from "./src/obj";

const scheduledTasks = new Map<string, cron.ScheduledTask>();

const generators = new Map<string, Obj<Generator>>();
const tasks = new Map<string, Obj<TaskWithEntities>>();

(async () => {
  const browser = new SuperbeesBrowser({
    // chromium: { headless: false },
    // firefox: { headless: false },
  });
  const uncaptcha = new SuperbeesUncaptcha(credentials["captcha-solvers"]);
  const proxy = new SuperbeesProxy(credentials["proxy-services"]);

  const queue = queues.registerScriptsQueue({ tasks, generators, browser, uncaptcha, proxy, prisma: db });

  // @ts-expect-error
  actions.handleOnGeneratorCreate(generators, scheduledTasks, queue);

  // @ts-expect-error
  actions.handleOnTaskCreate(tasks, scheduledTasks, queue);

  actions.handleOnScriptRun({ browser, uncaptcha, proxy, prisma: db });

  process.send?.(`ready`);
})();

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

const browser = new SuperbeesBrowser({
  chromium: { headless: false, args: ["--headless=new"] },
  firefox: { headless: false },
});
const uncaptcha = new SuperbeesUncaptcha(credentials["captcha-solvers"]);
const proxy = new SuperbeesProxy(credentials["proxy-services"]);

(async () => {
  const queue = queues.registerScriptsQueue({ tasks, generators, browser, uncaptcha, proxy, prisma: db });
  await actions.reDeployGenerators(generators, scheduledTasks, queue);
  await actions.reDeployTasks(tasks, scheduledTasks, queue);

  actions.handleOnGeneratorCreate(generators, scheduledTasks, queue);
  actions.handleOnGeneratorTrack(generators);
  actions.handleOnGeneratorList(generators);
  actions.handleOnGeneratorPause(generators);
  actions.handleOnGeneratorActivate(generators);
  actions.handleOnGeneratorComplete(generators);

  actions.handleOnTaskCreate(tasks, scheduledTasks, queue);
  actions.handleOnTaskTrack(tasks);
  actions.handleOnTaskList(tasks);
  actions.handleOnTaskPause(tasks);
  actions.handleOnTaskComplete(tasks);

  actions.handleOnScriptRun({ browser, uncaptcha, proxy, prisma: db });

  process.send?.(`ready`);
})();

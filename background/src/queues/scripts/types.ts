import type SuperbeesBrowser from "@superbees/browser";
import type SuperbeesUncaptcha from "@superbees/uncaptcha";
import type SuperbeesProxy from "@superbees/proxy";
import type { PrismaClient } from "@prisma/client";

import { Generator, TaskWithEntities } from "../../prisma-client";
import type Obj from "../../obj";

export interface ExecutionQueueHandlerArgs {
  browser: SuperbeesBrowser;
  uncaptcha: SuperbeesUncaptcha;
  proxy: SuperbeesProxy;
  prisma: PrismaClient;

  generators: Map<string, Obj<Generator>>;
  tasks: Map<string, Obj<TaskWithEntities>>;
}

export enum ScriptHandlers {
  GENERATOR = "GENERATOR",
  TASK = "TASK",
}

import type { PrismaClient } from "@prisma/client";
import type { Logger } from "@superbees/logger";
import type SuperbeesBrowser from "@superbees/browser";
import type SuperbeesUncaptcha from "@superbees/uncaptcha";
import type SuperbeesProxy from "@superbees/proxy";
import { runScriptUtil } from "./run";

interface SuperbeesScriptBaseOptions<T> {
  browser: SuperbeesBrowser;
  uncaptcha: SuperbeesUncaptcha;
  proxy: SuperbeesProxy;
  util: typeof runScriptUtil;
  logger: Logger;
  prisma: PrismaClient;

  vars?: T;
}
export interface SuperbeesScriptFunctionOptions<T> extends SuperbeesScriptBaseOptions<T> {}

export interface SuperbeesScriptUtilFunctionOptions<T> extends SuperbeesScriptBaseOptions<T> {}

export type * from "@superbees/browser";
export type * from "@superbees/uncaptcha";
export type * from "@superbees/proxy";

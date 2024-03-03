import SuperbeesBrowser from "@superbees/browser";
import SuperbeesUncaptcha from "@superbees/uncaptcha";
import SuperbeesProxy from "@superbees/proxy";
import { runScriptUtil } from "./helpers";

interface SuperbeesScriptBaseOptions<T> {
  browser: SuperbeesBrowser;
  uncaptcha: SuperbeesUncaptcha;
  proxy: SuperbeesProxy;
  util: typeof runScriptUtil;

  vars?: T;
}
export interface SuperbeesScriptFunctionOptions<T> extends SuperbeesScriptBaseOptions<T> {}

export interface SuperbeesScriptUtilFunctionOptions<T> extends SuperbeesScriptBaseOptions<T> {}

export type * from "@superbees/browser";
export type * from "@superbees/uncaptcha";
export type * from "@superbees/proxy";

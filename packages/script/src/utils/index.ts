import * as util from "util";

export * as extensions from "./browser-extensions";
export * as resources from "@superbees/resources";
export * as profile from "./create-profile";
export * as wallet from "./create-wallet";

export const sleep = (ms?: number) => util.promisify(setTimeout)(ms);

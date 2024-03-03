import type * as types from "./types";
import * as path from "path";

async function run<ARGS extends unknown[]>(type: "script" | "util", name: string, args: ARGS) {
  const scriptsDir = path.join(__dirname, "../../../scripts");
  const utilsDir = path.join(__dirname, "../../../scripts/utils");
  const script = await import(path.join(type === "script" ? scriptsDir : utilsDir, name));
  return script.default(...args);
}

export async function runScript<T = unknown>(name: string, args: types.SuperbeesScriptFunctionOptions<T>) {
  return run("script", name, [args]);
}

export async function runScriptUtil<T = unknown>(name: string, args: [page: types.InjectedPage, options: types.SuperbeesScriptUtilFunctionOptions<T>]) {
  return run("util", name, args);
}

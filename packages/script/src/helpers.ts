import { InjectedContext, InjectedPage } from "@superbees/browser";
import path from "node:path";
import { SuperbeesScriptFunctionOptions, SuperbeesScriptUtilFunctionOptions } from "./types";

export interface ExtensionData {
  id: string;
  version: string;
}
export type ExtensionsData = Record<string, ExtensionData>;
export async function getChromeExtensionsData(context: InjectedContext) {
  const extensionsData: ExtensionsData = {};
  const page = await context.newPage();

  await page.goto("chrome://extensions");
  await page.waitForLoadState("load");
  await page.waitForLoadState("domcontentloaded");

  const devModeButton = page.locator("#devMode");
  await devModeButton.waitFor();
  await devModeButton.focus();
  await devModeButton.click();

  const extensionDataItems = await page.locator("extensions-item").all();
  for (const extensionData of extensionDataItems) {
    const extensionName = (await extensionData.locator("#name-and-version").locator("#name").textContent())?.toLowerCase();
    const extensionVersion = (await extensionData.locator("#name-and-version").locator("#version").textContent())?.replace(/(\n| )/g, "");
    const extensionId = (await extensionData.locator("#extension-id").textContent())?.split(": ")[1];
    extensionsData[extensionName!] = {
      version: extensionVersion!,
      id: extensionId!,
    };
  }
  await page.close();

  return extensionsData;
}

async function run<ARGS extends unknown[]>(type: "script" | "util", name: string, args: ARGS) {
  const scriptsDir = path.join(__dirname, "../../../scripts");
  const utilsDir = path.join(__dirname, "../../../scripts/utils");
  const script = await import(path.join(type === "script" ? scriptsDir : utilsDir, name)).then((m) => m.default);
  return script(...args);
}

export async function runScript<T = unknown>(name: string, args: SuperbeesScriptFunctionOptions<T>) {
  return run("script", name, [args]);
}

export async function runScriptUtil<T = unknown>(name: string, args: [page: InjectedPage, options: SuperbeesScriptUtilFunctionOptions<T>]) {
  return run("util", name, args);
}

export * from "@superbees/resources";

import { InjectedContext } from "@superbees/browser";

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

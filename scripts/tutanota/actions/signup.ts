import * as async from "async";
import { authenticator } from "otplib";
import { faker } from "@faker-js/faker";

import * as script from "@superbees/script";

async function signup(opts: script.SuperbeesScriptFunctionOptions<unknown>) {
  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: false });
  const context = await opts.browser.newContext("", {
    driverType: "chromium",
    browserContextOptions: { permissions: ["clipboard-read", "clipboard-write"], proxy: { server: proxy.server } },
  });
  await context.registerCachingHandler(/^http(s?):\/\/app\.tuta\.com\/(?!rest).*/);
  const page = await context.newPage();

  try {
    opts.logger.info(`Navigating to "https://app.tuta.com"`);
    await async.retry({ times: 5, interval: 200 }, async (callback) => {
      const response = await page.goto("https://app.tuta.com", { waitUntil: "networkidle" });
      if (response?.status() !== 200) callback(new Error("failed to load page"));
      callback(null, true);
    });
  } finally {
    await context.close();
  }
}

export default signup;

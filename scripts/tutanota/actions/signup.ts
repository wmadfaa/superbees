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
  const page = await context.newPage();

  try {
    await async.retry({ times: 5, interval: 200 }, async () => {
      const response = await page.goto("https://app.tuta.com");
      if (response?.status() !== 200) throw new Error("failed to load page");
    });
  } finally {
    await context.close();
  }
}

export default signup;
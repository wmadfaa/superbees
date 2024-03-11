import * as async from "async";
import { faker } from "@faker-js/faker";
import { values } from "lodash";
import { AccountStatus } from "@prisma/client";

import * as script from "@superbees/script";

import Twitter from "../../utils/twitter/src/twitter";

async function signup(opts: script.SuperbeesScriptFunctionOptions<any>) {
  const entity = await opts.prisma.entity.findUniqueOrThrow({ where: { id: opts.entityId || opts.vars.entityId }, include: { email: true } });

  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext(entity.id, {
    driverType: "firefox",
    fingerprintOptions: { screen: { maxWidth: 1440 } },
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers((url) => values(script.constants.CACHEABLE_REGEX).some((r) => r.test(url.toString())));

  const page = await context.newPage();
  const $: Twitter = await opts.util("twitter", [page, opts]);

  const storeDB = {
    username: faker.internet.displayName({ firstName: entity.firstname, lastName: entity.lastname }).toLowerCase(),
    password: faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }) }),
    status: AccountStatus.UNKNOWN as AccountStatus,
  };

  try {
    await page.goto("https://twitter.com", { waitUntil: "domcontentloaded" });
    await $.waitUntilStable();

    await $.waitAndClick(`//a[@data-testid="signupButton"]`);
    await $.waitUntilStable();

    await $.waitFor(`//div[@role="dialog" and @aria-modal="true" and .//span[text()="Create your account"]]`);
    await $.waitAndFill(`//input[@name="name"]`, entity.firstname);
    const state = await $.raceUntilLocator([
      [`//div[@role="button" and ./span[text()="Use email instead"]]`, { onfulfilled: "email-switch-button", onrejected: "unknown" }],
      [`//input[@name="email"]`, { onfulfilled: "email-input", onrejected: "unknown" }],
    ]);
    if (!state || state === "unknown") throw `email input is missing`;
    else if (state === "email-switch-button") {
      await $.waitAndClick(`//div[@role="button" and ./span[text()="Use email instead"]]`);
    }
    await $.waitAndFill(`//input[@name="email"]`, entity.email.username);
    const birthdate = new Date(entity.birthdate);
    await $.waitAndSelectOption(`//label[./span[text()="Month"]]/following-sibling::select`, birthdate.getMonth() + 1);
    await $.waitAndSelectOption(`//label[./span[text()="Day"]]/following-sibling::select`, birthdate.getDate());
    await $.waitAndSelectOption(`//label[./span[text()="Year"]]/following-sibling::select`, birthdate.getFullYear());
    await $.waitAndClick(`//div[@role="button" and .//span[text()="Next"]]`);
    await $.waitUntilStable();

    const f_state = await $.raceWithCaptcha([
      [
        // `//div[@role="dialog" and @aria-modal="true" and .//span[matches(text(),"(Customize|Customise) your experience")]]`,
        `//div[@role="button" and .//span[text()="Next"]]`,
        { onfulfilled: "customise-your-experience-dialog", onrejected: "unknown" },
      ],
    ]);
    if (f_state?.startsWith(`captcha:`)) await $.solveCaptcha(f_state);
  } finally {
    // if (storeDB.status === AccountStatus.VERIFIED) {
    //   await context.close(entity.id);
    // } else {
    //   await context.close();
    // }
    //
    // await opts.proxy.releaseProxy("dataimpulse", proxy);
  }
}

export default signup;

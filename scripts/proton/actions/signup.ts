import * as async from "async";
import { faker } from "@faker-js/faker";
import { EmailPlatform, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";

import Proton from "../../utils/proton/src/proton";

async function signup(opts: script.SuperbeesScriptFunctionOptions<unknown>) {
  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext("", {
    driverType: "chromium",
    fingerprintOptions: { screen: { maxWidth: 1440 } },
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers((url) =>
    [
      script.constants.CACHEABLE_REGEX.PROTON_ACCOUNT_CACHEABLE_REGEX,
      script.constants.CACHEABLE_REGEX.PROTON_MAIL_CACHEABLE_REGEX,
      script.constants.CACHEABLE_REGEX.TUTANOTA_CACHEABLE_REGEX,
    ].some((r) => r.test(url.toString())),
  );

  const page = await context.newPage();
  const $: Proton = await opts.util("proton", [page, opts]);

  const entity = await script.utils.profile.createProfile();
  const storeDB = {
    domain: "proton.me",
    username: faker.internet.displayName({ firstName: entity.firstname, lastName: entity.lastname }).toLowerCase(),
    password: faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }) }),
    status: EmailStatus.UNKNOWN as EmailStatus,
  };

  try {
    await async.retry({ times: 5, interval: 200 }, async (callback) => {
      const response = await page.goto("https://account.proton.me/mail/signup");
      if (response?.status() !== 200) callback(new Error("failed to load page"));
      callback(null);
    });
    await $.waitUntilStable();

    opts.logger.info(`select domain`);
    const username = await $.waitForFrame(`//iframe[@title="Username"]`);
    const select_domain_button = username.locator(`//button[@id="select-domain"]`);
    if (Math.random() > 0.65) {
      await $.waitAndClick(select_domain_button);
      const domain_button = page.locator(`//div[@role="dialog"]//li/button`);
      await $.waitAndClick(domain_button.last());
      await script.utils.sleep(100);
    }
    const domain = await select_domain_button.getAttribute("aria-label");
    if (!domain) throw `couldn't get the selected account domain`;
    storeDB.domain = domain;

    opts.logger.info(`enter password`);
    await $.waitAndFill(`//input[@id="password"]`, storeDB.password);
    await $.waitAndFill(`//input[@id="repeat-password"]`, storeDB.password);

    opts.logger.info(`enter username`);
    await async.retry<void, string>(3, async (callback) => {
      await $.waitAndFill(username.locator(`//input[@id="email"]`), storeDB.username);
      await $.waitAndClick(`//button[text()="Create account"]`);

      const state = await $.raceUntilLocator([
        [`//span[text()="Username already used"]`, { onfulfilled: "Username already used", onrejected: "unknown signup flow" }],
        [`//button[text()="Continue with Free"]`, { onfulfilled: "success", onrejected: "unknown signup flow" }],
      ]);
      if (state !== "success") {
        if (state === "Username already used") await $.waitAndClick(`//button[@data-testid="notification:undo-button"]`);
        storeDB.username = faker.internet.displayName({ firstName: entity.firstname, lastName: entity.lastname }).toLowerCase();
        return callback(state);
      }

      return callback(null);
    });

    opts.logger.info(`select free plan`);
    await $.waitAndClick(`//button[text()="Continue with Free"]`);
    await $.waitUntilStable();

    await $.waitFor(`//h1[text()="Verification"]`);

    const state = await $.raceUntilLocator([
      [`//button[@data-testid="tab-header-captcha-button" and @aria-selected="true"]`, { onfulfilled: "captcha-tab-selected", onrejected: "unknown" }],
      [`//button[@data-testid="tab-header-captcha-button" and @aria-selected="false"]`, { onfulfilled: "captcha-tab-unselected", onrejected: "unknown" }],
      [`//iframe[@title="Captcha"]`, { onfulfilled: "captcha-iframe", onrejected: "unknown" }],
      [`//button[@data-testid="tab-header-email-button" and @aria-selected="true"]`, { onfulfilled: "email-tab-selected", onrejected: "unknown" }],
      [`//button[@data-testid="tab-header-email-button" and @aria-selected="false"]`, { onfulfilled: "email-tab-unselected", onrejected: "unknown" }],
      [`//input[@id="email"]`, { onfulfilled: "email-input", onrejected: "unknown" }],
      [`//button[@data-testid="tab-header-sms-button" and @aria-selected="true"]`, { onfulfilled: "phone-tab-selected", onrejected: "unknown" }],
      [`//button[@data-testid="tab-header-sms-button" and @aria-selected="false"]`, { onfulfilled: "phone-tab-unselected", onrejected: "unknown" }],
      [`//input[@id="phone"]`, { onfulfilled: "phone-input", onrejected: "unknown" }],
    ]);
    if (!state || state === "unknown") throw `no visible verification method was found`;

    opts.logger.info(`solve captcha`);
    if (state.startsWith("captcha")) {
      if (state === "captcha-tab-unselected") await $.waitAndClick(`//button[@data-testid="tab-header-captcha-button"]`);
      await $.solve_captcha();
    } else {
      throw `unsupported verification method: ${state}`;
    }

    opts.logger.info(`wait for loading`);
    const sdn_state = await $.wait_for_loading([
      [`//*[contains(text(),"Creating your account")]`, { onfulfilled: "loading", onrejected: "unknown" }],
      [`//h1[text()="Set a display name"]`, { onfulfilled: "set-display-name", onrejected: "unknown" }],
    ]);
    if (sdn_state !== "set-display-name") throw `unknown loading state: [${sdn_state}]`;

    opts.logger.info(`confirm the username`);
    const displayName = await $.waitAndGetAttribute(`//input[@id="displayName"]`, "value");
    if (displayName) storeDB.username = displayName;
    await $.waitAndClick(`//button[text()="Continue"]`);
    await $.waitUntilStable();

    opts.logger.info(`ignore setting a recovery method`);
    await $.unThrow($.waitFor(`//h1[text()="Set up a recovery method"]`));
    await $.waitAndClick(`//button[text()="Maybe later"]`);
    await $.waitAndClick(`//button[text()="Confirm"]`);

    opts.logger.info(`wait for loading`);
    const obs_state = await $.wait_for_loading([
      [`//*[contains(text(),"Loading Proton Mail")]`, { onfulfilled: "loading", onrejected: "unknown" }],
      [`//dialog[.//h1[text()="Congratulations on choosing privacy"]]`, { onfulfilled: "congratulations", onrejected: "unknown" }],
    ]);
    if (obs_state !== "congratulations") throw `unknown loading state: [${obs_state}]`;

    opts.logger.info(`complete onboarding steps`);
    await $.waitAndClick(`//dialog[.//h1[text()="Congratulations on choosing privacy"]]//button[text()="Next"]`);
    await $.waitAndClick(`//dialog[.//h1[text()="Pick a theme"]]//button[text()="Next"]`);
    await $.waitAndClick(`//dialog[.//h1[text()="Automatically forward emails"]]//button[text()="Skip"]`);
    await $.waitAndClick(`//div[@data-testid="onboarding-checklist"]//button[text()="Maybe later"]`);

    storeDB.status = EmailStatus.VERIFIED;
  } finally {
    if (storeDB.status === EmailStatus.VERIFIED) {
      const $entity = await opts.prisma.$transaction(async (prisma) => {
        const { id } = await prisma.email.create({
          data: { platform: EmailPlatform.PROTONMAIL, username: `${storeDB.username}${storeDB.domain}`, password: storeDB.password, status: storeDB.status } as any,
        });
        return prisma.entity.create({
          data: { emailId: id, firstname: entity.firstname, lastname: entity.lastname, birthdate: entity.birthdate, gender: entity.gender, country: entity.country } as any,
        });
      });
      await context.close($entity.id);
    } else {
      await context.close();
    }

    await opts.proxy.releaseProxy("dataimpulse", proxy);
  }
}

export default signup;

import * as async from "async";
import { faker } from "@faker-js/faker";
import { EmailPlatform, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";

import Tutanota from "../../utils/tutanota/src/tutanota";

async function signup(opts: script.SuperbeesScriptFunctionOptions<unknown>) {
  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext("", {
    driverType: "chromium",
    fingerprintOptions: { screen: { maxWidth: 1440 } },
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers(script.constants.CACHEABLE_REGEX.TUTANOTA_CACHEABLE_REGEX);
  const page = await context.newPage();
  const $: Tutanota = await opts.util("tutanota", [page, opts]);

  const entity = await script.utils.profile.createProfile();
  const storeDB = {
    domain: "@tutamail.com",
    username: faker.internet.displayName({ firstName: entity.firstname, lastName: entity.lastname }).toLowerCase(),
    password: faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }) }),
    status: EmailStatus.UNKNOWN as EmailStatus,
    entityId: undefined as string | undefined,
  };

  try {
    await $.go_to_root_if_needed();

    opts.logger.info(`select free plan`);
    await $.waitAndClick(`//button[@title="Sign up"]`);
    await $.trackLocatorStateUntil(`//p[@id='dialog-title' and .//text()="Loading ..."]`, { state: ["hidden"] });

    await $.waitAndClick(`(//button[@title="Select"])[1]`);

    opts.logger.info(`agree to not create multiple accounts`);
    await $.waitAndClick(`//label[text()="I do not own any other Free account."]/input`);
    await $.waitAndClick(`//label[text()="I will not use this account for business."]/input`);
    await $.waitAndClick(`//button[@title="Ok"]`);
    await $.waitUntilStable();

    opts.logger.info(`select account domain`);
    await $.waitAndClick(`//button[@title="Domain"]`);
    await $.waitFor(`//div[@role="menu"]`);
    const count = await page.locator(`//button[@role="menuitem" and not(descendant::*[local-name() = 'svg'])]`).count();
    await $.waitAndClick(`//button[@role="menuitem" and not(descendant::*[local-name() = 'svg'])][${faker.number.int({ min: 1, max: count })}]`);
    await script.utils.sleep(100);
    const domain = await page.locator(`//button[@title='Domain' and @aria-label='Domain']/preceding-sibling::div[1]`).textContent();
    if (!domain) throw `couldn't get the selected account domain`;
    storeDB.domain = domain;

    opts.logger.info(`enter a unique username`);
    await async.retry({ times: 1000, interval: 100 }, async (callback) => {
      const s = await $.raceUntilLocator([
        [`//small[./*[text()="Enter preferred email address"]]`, { onfulfilled: "empty", onrejected: "unknown", timeout: 100 }],
        [`//small[./*[text()="Verifying email address ..."]]`, { onfulfilled: "verifying", onrejected: "unknown", timeout: 100 }],
        [`//small[./*[text()="Email address is available."]]`, { onfulfilled: "available", onrejected: "unknown", timeout: 100 }],
        [`//small[./*[text()="Email address is not available."]]`, { onfulfilled: "unavailable", onrejected: "unknown", timeout: 100 }],
      ]);
      if (s === "available") return callback(null);
      if (/unavailable|empty/.test(s!)) {
        if (s === "unavailable") storeDB.username = faker.internet.displayName({ firstName: entity.firstname, lastName: entity.lastname }).toLowerCase();
        await $.waitAndFill(`//div[@id="signup-account-dialog"]//input[@aria-label="Email address"]`, storeDB.username);
      }
      callback(new Error(`username input status: [${s}]`));
    });

    opts.logger.info(`enter a strong password`);
    await async.retry({ times: 1000, interval: 100 }, async (callback) => {
      const s = await $.raceUntilLocator([
        [`//small[.//*[text()="Please enter a new password."]]`, { onfulfilled: "empty", onrejected: "unknown", timeout: 100 }],
        [`//small[.//*[text()="Password ok."]]`, { onfulfilled: "ok", onrejected: "unknown", timeout: 100 }],
        [`//small[.//*[text()="Password is not secure enough."]]`, { onfulfilled: "unsecure", onrejected: "unknown", timeout: 100 }],
      ]);
      if (s === "ok") return callback(null);
      if (/unsecure|empty/.test(s!)) {
        if (s === "unsecure") storeDB.password = faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }) });
        await $.waitAndFill(`//div[@id="signup-account-dialog"]//input[@aria-label="Set password"]`, storeDB.password);
      }
      return callback(new Error(`password input status: [${s}]`));
    });

    await async.retry({ times: 1000, interval: 100 }, async (callback) => {
      const s = await $.raceUntilLocator([
        [`//small[./*[text()="Please confirm your password."]]`, { onfulfilled: "empty", onrejected: "unknown", timeout: 100 }],
        [`//small[./*[text()="Password ok."]]`, { onfulfilled: "ok", onrejected: "unknown", timeout: 100 }],
        [`//small[./*[text()="Confirmed password is different."]]`, { onfulfilled: "different", onrejected: "unknown", timeout: 100 }],
      ]);
      if (s === "ok") return callback(null);
      if (/different|empty/.test(s!)) {
        await $.waitAndFill(`//div[@id="signup-account-dialog"]//input[@aria-label="Repeat password"]`, storeDB.password);
      }
      return callback(new Error(`password input status: [${s}]`));
    });

    opts.logger.info(`agree to tutanota terms-and-conditions`);
    await $.waitAndClick(`//label[contains(text(),"I have read and agree to the following documents:")]/input`);
    await $.waitAndClick(`//label[text()="I am at least 16 years old."]/input`);

    await $.waitAndClick(`//button[@title="Next"]`);

    opts.logger.info(`wait for account to be prepared`);
    const state = await $.trackLocatorStateUntil(`//p[@id='dialog-title' and .//text()="Preparing account ..."]`, {
      state: ["detached", "blocked", "congratulations", "captcha"],
      extra_locators: [
        [`//*[contains(text(),"Registration is temporarily blocked")]`, { onfulfilled: "blocked", onrejected: "unknown" }],
        [`//div[@id="dialog-title" and .//*[text()="Congratulations"]]`, { onfulfilled: "congratulations", onrejected: "unknown" }],
        [`//div[@id="dialog-title" and .//*[text()="Captcha"]]`, { onfulfilled: "captcha", onrejected: "unknown" }],
      ],
    });
    if (/detached|blocked/.test(state!)) throw `Registration is temporarily blocked`;
    await $.waitUntilStable();

    if (state === "captcha") {
      opts.logger.info(`solve captcha`);
      await $.solve_captcha();
    }

    opts.logger.info(`ignore the recovery-code`);
    await $.waitAndClick(`//button[@title="Ok"]`);
    await $.waitUntilStable();

    opts.logger.info(`verify ${EmailPlatform.TUTANOTA} status`);
    storeDB.status = await $.login({ username: `${storeDB.username}${storeDB.domain}`, password: storeDB.password });
    if (!/VERIFIED|PENDING/.test(storeDB.status)) throw `completed with status: ${storeDB.status}`;
    opts.logger.info(`verified status: ${storeDB.status}`);
  } finally {
    if ([EmailStatus.VERIFIED, EmailStatus.PENDING].some((s) => s === storeDB.status)) {
      const $entity = await opts.prisma.$transaction(async (prisma) => {
        const { id } = await prisma.email.create({
          data: { platform: EmailPlatform.TUTANOTA, username: `${storeDB.username}${storeDB.domain}`, password: storeDB.password, status: storeDB.status } as any,
        });
        return prisma.entity.create({
          data: { emailId: id, firstname: entity.firstname, lastname: entity.lastname, birthdate: entity.birthdate, gender: entity.gender, country: entity.country } as any,
        });
      });
      await context.close($entity.id);
    } else {
      await context.close();
    }

    await context.close(storeDB.entityId);
    await opts.proxy.releaseProxy("dataimpulse", proxy);
  }
}

export default signup;

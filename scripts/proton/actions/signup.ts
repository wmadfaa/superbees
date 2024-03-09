import * as async from "async";
import { faker } from "@faker-js/faker";
import { EmailPlatform, EmailStatus, Email } from "@prisma/client";

import * as script from "@superbees/script";

import Proton from "../../utils/proton/src/proton";
import Tutanota from "../../utils/tutanota/src/tutanota";

async function signup(opts: script.SuperbeesScriptFunctionOptions<unknown>) {
  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext("", {
    driverType: "chromium",
    fingerprintOptions: { screen: { maxWidth: 1440 } },
    browserContextOptions: { permissions: ["clipboard-read", "clipboard-write"], proxy: { server: proxy.server } },
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
    entityId: undefined as string | undefined,
  };

  try {
    await async.retry({ times: 5, interval: 200 }, async (callback) => {
      const response = await page.goto("https://account.proton.me/mail/signup");
      if (response?.status() !== 200) callback(new Error("failed to load page"));
      callback(null);
    });
    await $.waitUntilStable();
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

    await $.waitAndFill(`//input[@id="password"]`, storeDB.password);
    await $.waitAndFill(`//input[@id="repeat-password"]`, storeDB.password);

    await async.retry<void, string>(3, async (callback) => {
      await $.waitAndFill(username.locator(`//input[@id="email"]`), storeDB.username);
      await $.waitAndClick(`//button[text()="Create account"]`);

      const state = await $.raceUntilLocator([
        [`//span[text()="Username already used"]`, { onfulfilled: "Username already used", onrejected: "unknown signup flow" }],
        [`//button[text()="Continue with Free"]`, { onfulfilled: "success", onrejected: "unknown signup flow" }],
      ]);
      if (state !== "success") {
        storeDB.username = faker.internet.displayName({ firstName: entity.firstname, lastName: entity.lastname }).toLowerCase();
        return callback(state);
      }

      return callback(null);
    });

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

    if (state.startsWith("captcha")) {
      if (state === "captcha-tab-unselected") await $.waitAndClick(`//button[@data-testid="tab-header-captcha-button"]`);
      await $.solve_captcha();
    } else if (state.startsWith("email")) {
      if (state === "email-tab-unselected") await $.waitAndClick(`//button[@data-testid="tab-header-email-button"]`);

      const verification_email_page = await context.newPage();
      try {
        const $tutanota: Tutanota = await opts.util("tutanota", [verification_email_page, opts]);

        const verification_email_account = await async.retry<Email, string>(3, async (callback) => {
          const $e = await opts.prisma.$transaction(async (prisma) => {
            const emails_filter = { status: EmailStatus.VERIFIED, NOT: { usedBy: { has: EmailPlatform.PROTONMAIL } } };
            const unused_emails_count = await prisma.email.count({ where: emails_filter });
            const { id, usedBy } = await prisma.email.findFirstOrThrow({ where: emails_filter, take: 1, skip: Math.floor(Math.random() * unused_emails_count) } as any);
            return prisma.email.update({ where: { id }, data: { usedBy: [...usedBy, EmailPlatform.PROTONMAIL] } } as any);
          });
          const email_status = await $tutanota.login($e);
          if (email_status !== EmailStatus.VERIFIED) return callback("unverified");
          return callback(null, $e);
        });

        await page.bringToFront();
        await $.waitAndFill(`//input[@id="email"]`, verification_email_account.username);
        await $.waitAndClick(`//button[text()="Get verification code"]`);

        const verificationInput = await $.waitFor(`//input[@id="verification"]`);
        const sentTime = new Date().getTime() - 10000;

        await verification_email_page.bringToFront();
        const verification_email = await $tutanota.get_expected_email(async (d) => {
          if (!("subject" in d)) return "continue";
          if (d.subject!.includes("Proton Verification Code")) {
            if (!("sentAt" in d)) return "continue";
            else if (d.sentAt!.getTime() >= sentTime) {
              if (!("body" in d)) return "continue";
              else return "take";
            }
          }
          return "jump";
        });
        const verificationCode = verification_email.body?.match(/([0-9]{6}).*/)?.[1];
        if (!verificationCode) throw "verification code not found";

        await page.bringToFront();
        await $.waitAndFill(verificationInput, verificationCode);
        await $.waitAndClick(`//button[text()="Verify"]`);
      } finally {
        await verification_email_page.close();
      }
    } else {
      throw `unsupported verification method: ${state}`;
    }

    const sdn_state = await $.wait_for_loading([
      [`//*[contains(text(),"Creating your account")]`, { onfulfilled: "loading", onrejected: "unknown" }],
      [`//h1[text()="Set a display name"]`, { onfulfilled: "set-display-name", onrejected: "unknown" }],
    ]);
    if (sdn_state !== "set-display-name") throw `unknown loading state: [${sdn_state}]`;

    // //input[@id="displayName"]
    await $.waitAndClick(`//button[text()="Continue"]`);
    await $.waitUntilStable();

    // //h1[text()="Set up a recovery method"]
    await $.waitAndClick(`//button[text()="Maybe later"]`);
    await $.waitAndClick(`//button[text()="Confirm"]`);

    const obs_state = await $.wait_for_loading([
      [`//*[contains(text(),"Loading Proton Mail")]`, { onfulfilled: "loading", onrejected: "unknown" }],
      [`//dialog[.//h1[text()="Congratulations on choosing privacy"]]`, { onfulfilled: "congratulations", onrejected: "unknown" }],
    ]);
    if (obs_state !== "congratulations") throw `unknown loading state: [${obs_state}]`;

    await $.waitAndClick(`//dialog[.//h1[text()="Congratulations on choosing privacy"]]//button[text()="Next"]`);
    await $.waitAndClick(`//dialog[.//h1[text()="Pick a theme"]]//button[text()="Next"]`);
    await $.waitAndClick(`//dialog[.//h1[text()="Automatically forward emails"]]//button[text()="Skip"]`);
    await $.waitAndClick(`//div[@data-testid="onboarding-checklist"]//button[text()="Maybe later"]`);
  } finally {
    await context.close(storeDB.entityId);
    await opts.proxy.releaseProxy("dataimpulse", proxy);
  }
}

export default signup;

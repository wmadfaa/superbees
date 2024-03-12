import { faker } from "@faker-js/faker";
import { merge, values } from "lodash";
import { AccountPlatform, AccountStatus, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";

import Twitter from "../../utils/twitter/src/twitter";
import { EmailClass } from "../../utils/email";

async function signup(opts: script.SuperbeesScriptFunctionOptions<any>) {
  const entity = await opts.prisma.entity.findUniqueOrThrow({ where: { id: opts.entityId || opts.vars.entityId }, include: { email: true } });

  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext(entity.id, {
    driverType: "chromium",
    fingerprintOptions: { screen: { maxWidth: 1440 } },
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers((url) => values(script.constants.CACHEABLE_REGEX).some((r) => r.test(url.toString())));

  const email_page = await context.newPage();
  const $e: EmailClass = await opts.util("email", [email_page, merge(opts, { vars: { platform: entity.email.platform } })]);

  const page = await context.newPage();
  const $: Twitter = await opts.util("twitter", [page, opts]);

  const storeDB = {
    username: undefined as string | undefined,
    totop_secret_code: undefined as string | undefined,
    password: faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }) }),
    status: AccountStatus.UNKNOWN as AccountStatus,
  };

  try {
    opts.logger.info(`verify email account status: "${entity.email.username}"`);
    await email_page.bringToFront();
    const email_status = await $e.login(entity.email);
    if (email_status !== EmailStatus.VERIFIED) throw `email account is not verified: (state=${email_status})`;
    await $e.waitUntilStable();

    opts.logger.info(`navigate to twitter.com`);
    await page.bringToFront();
    await page.goto("https://twitter.com", { waitUntil: "domcontentloaded" });
    await $.waitUntilStable();

    await $.waitAndClick(`//a[@data-testid="signupButton"]`);
    await $.waitUntilStable();

    opts.logger.info(`fill in base user details`);
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

    const f_state = await $.race_with_captcha([
      [`//div[@role="dialog" and @aria-modal="true" and .//span[contains(text(),"your experience")]]`, { onfulfilled: "customise-experience-dialog", onrejected: "unknown" }],
    ]);
    if (f_state?.startsWith(`captcha:`)) {
      opts.logger.info(`solve captcha challenge`);
      await $.solve_captcha(f_state);
    } else if (f_state === "customise-experience-dialog") {
      opts.logger.info(`skip customising experience step`);
      await $.waitAndClick(`//div[@data-testid="ocfSettingsListNextButton"]`);
      await $.waitUntilStable();

      const s_f_state = await $.race_with_captcha([[`//input[@name="verfication_code"]`, { onfulfilled: "verification-code-input", onrejected: "unknown" }]]);
      if (s_f_state?.startsWith(`captcha:`)) {
        opts.logger.info(`solve captcha challenge`);
        await $.solve_captcha(s_f_state);
      } else if (s_f_state !== `verification-code-input`) throw `unknown flow: (state=${s_f_state}})`;
    }

    const sentAt = new Date().setUTCSeconds(0, 0);
    const verification_code_input = await $.waitFor(`//input[@name="verfication_code"]`);

    opts.logger.info(`solve email verification challenge`);
    await email_page.bringToFront();
    const emailData = await $e.get_expected_email(
      async (email) => {
        if (!("subject" in email)) return "continue";
        else if (!email.subject?.includes("your X verification")) return "jump";

        if (!("sentAt" in email)) return "continue";
        else if (Number(email.sentAt) < sentAt) return "jump";

        return "take";
      },
      async () => {
        await page.bringToFront();
        await $.waitAndClick(`//span[@role="button" and .//span[text()="Didn't receive email?"]]`);
        const dropdown_path = `//div[@data-testid="Dropdown" and .//span[text()="Didn’t receive email?"]]`;
        await $.waitFor(dropdown_path);
        await $.waitAndClick(`${dropdown_path}/div[@role="menuitem" and .//span[text()="Resend email"]]`);
        await email_page.bringToFront();
      },
    );
    await email_page.close();
    const verification_code = emailData.subject?.match(/([0-9]{6}).*/)?.[1];
    if (!verification_code) throw `verification code not found in: ${JSON.stringify(emailData)}`;

    await page.bringToFront();
    await $.waitAndFill(verification_code_input, verification_code);
    await $.waitAndClick(`//div[@role="button" and .//span[text()="Next"]]`);
    await $.waitUntilStable();

    const sp_state = await $.raceUntilLocator(
      [
        [`//input[@name="password"]`, { onfulfilled: "set-password", onrejected: "unknown" }],
        [`//div[@role="alertdialog" and .//span[text()="Can't complete your signup right now."]]`, { onfulfilled: "signup-blocked", onrejected: "unknown" }],
      ],
      undefined,
      (s) => !s || s === "unknown",
    );
    if (!sp_state || sp_state === "unknown") throw `unknown flow: (state=${sp_state})`;
    if (sp_state === "signup-blocked") throw `signup temporarily blocked`;

    opts.logger.info(`set account's password`);
    await $.waitAndFill(`//input[@name="password"]`, storeDB.password);
    await $.waitAndClick(`//div[@data-testid="LoginForm_Login_Button"]`);
    await $.waitUntilStable();
    storeDB.status = AccountStatus.PENDING;

    opts.logger.info(`set account's pfp`);
    const pp_state = await $.raceUntilLocator(
      [
        [`//input[@data-testid="fileInput"]`, { onfulfilled: "set-profile-picture", onrejected: "unknown" }],
        [`//form[starts-with(@action,"/account/access")]`, { onfulfilled: "account-is-locked", onrejected: "unknown" }],
      ],
      undefined,
      (s) => !s || s === "unknown",
    );
    if (!pp_state || pp_state === "unknown") throw `unknown flow: (state=${pp_state})`;
    if (pp_state === "account-is-locked") {
      storeDB.status = AccountStatus.BLOCKED;
      throw `account has been locked`;
    }

    await $.locator(`//input[@data-testid="fileInput"]`).setInputFiles(await script.utils.opensea.consumeOnePfp());
    await $.waitAndClick(`//div[@data-testid="applyButton"]`, { timeout: 6000 });
    await $.waitAndClick(`//div[@data-testid="ocfSelectAvatarNextButton"]`, { timeout: 6000 });
    await $.waitUntilStable();

    const un_state = await $.raceUntilLocator([[`//input[@name="username"]`, { onfulfilled: "set-username", onrejected: "unknown" }]], undefined, (s) => !s || s === "unknown");
    if (!un_state || un_state === "unknown") throw `unknown flow: (state=${un_state})`;
    opts.logger.info(`skip set-custom-username`);
    storeDB.username = (await $.waitAndGetAttribute(`//input[@name="username"]`, "value")) ?? undefined;
    await $.waitAndClick(`//div[@data-testid="ocfEnterUsernameSkipButton"]`);
    await $.waitUntilStable();

    const tn_state = await $.raceUntilLocator(
      [[`//div[@role="dialog" and @aria-modal="true" and .//span[text()="Turn on notifications"]]`, { onfulfilled: "turn-on-notifications", onrejected: "unknown" }]],
      undefined,
      (s) => !s || s === "unknown",
    );
    if (!tn_state || tn_state === "unknown") throw `unknown flow: (state=${tn_state})`;

    opts.logger.info(`skip turn-on-notifications`);
    await $.waitAndClick(`//div[@role="button" and .//span[text()="Skip for now"]]`);
    await $.waitUntilStable();

    const ws_state = await $.raceUntilLocator(
      [[`//div[@role="dialog" and @aria-modal="true" and .//span[text()="What do you want to see on X?"]]`, { onfulfilled: "set-interests", onrejected: "unknown" }]],
      undefined,
      (s) => !s || s === "unknown",
    );
    if (!ws_state || ws_state === "unknown") throw `unknown flow: (state=${ws_state})`;

    opts.logger.info(`set random interests`);
    const interests_path = `//div[@aria-label="Timeline: "]//li[@role="listitem"]`;
    await $.unThrow($.waitFor(`(${interests_path})[1]`));
    const interests_count = await $.locator(interests_path).count();

    const selected_interests = new Set<number>();

    while (selected_interests.size < 3) {
      let ran_idx: number;
      do {
        ran_idx = faker.number.int({ min: 1, max: interests_count });
      } while (selected_interests.has(ran_idx));

      await $.waitAndClick(`(${interests_path})[${ran_idx}]//div[@role="button" and starts-with(@aria-label,"Follow")]`);
      selected_interests.add(ran_idx);
    }

    await $.waitAndClick(`//div[@role="button" and .//span[text()="Next"]]`);
    await $.waitUntilStable();
    const si2_state = await $.raceUntilLocator(
      [[`//div[@role="dialog" and @aria-modal="true" and .//span[starts-with(text(),"Interests are used")]]`, { onfulfilled: "set-interests-2", onrejected: "unknown" }]],
      undefined,
      (s) => !s || s === "unknown",
    );
    if (si2_state === "set-interests-2") {
      opts.logger.info(`skip set-interests-categories`);
      await $.waitAndClick(`//div[@role="button" and .//span[text()="Next"]]`);
      await $.waitUntilStable();
    }

    opts.logger.info(`follow random accounts`);
    const dm_state = await $.raceUntilLocator(
      [[`//div[@role="dialog" and @aria-modal="true" and .//span[text()="Don’t miss out"]]`, { onfulfilled: "follow-users", onrejected: "unknown" }]],
      undefined,
      (s) => !s || s === "unknown",
    );
    if (!dm_state || dm_state === "unknown") throw `unknown flow: (state=${dm_state})`;

    const users_path = `//div[@aria-label="Timeline: "]//div[@data-testid="UserCell"]`;
    await $.unThrow($.waitFor(`(${users_path})[1]`));
    const users_count = await $.locator(users_path).count();

    const selected_users = new Set<number>();

    while (selected_users.size < 3) {
      let ran_idx: number;
      do {
        ran_idx = faker.number.int({ min: 1, max: users_count });
      } while (selected_users.has(ran_idx));

      await $.waitAndClick(`(${users_path})[${ran_idx}]//div[@role="button" and .//span[text()="Follow"]]`);
      selected_users.add(ran_idx);
    }

    await page.route("**/*", async (route, request) => {
      if (/image|media/.test(request.resourceType())) await route.abort("blockedbyclient");
      else await route.fallback();
    });

    await $.waitAndClick(`//div[@role="button" and .//span[text()="Next"]]`);
    await $.waitUntilStable();
    storeDB.status = AccountStatus.VERIFIED;

    if (await $.unThrow($.waitAndClick(`//div[@role="button" and .//span[text()="Accept all cookies"]]`, { timeout: 600 }), { onfulfilled: true })) {
      opts.logger.info(`accept all cookies`);
      await $.waitUntilStable();
    }

    storeDB.totop_secret_code = await $.add_2fa_auth({ password: storeDB.password });
  } finally {
    // //input[@value="Start"]
    // captcha
    // //input[@value="Continue to X"]

    if (storeDB.status === AccountStatus.VERIFIED || storeDB.status === AccountStatus.PENDING) {
      await opts.prisma.account.create({
        data: {
          entityId: entity.id,
          emailId: entity.emailId,
          username: storeDB.username ?? "",
          password: storeDB.password,
          status: storeDB.status,
          platform: AccountPlatform.TWITTER,
          metadata: storeDB.totop_secret_code ? { totop_secret_code: storeDB.totop_secret_code } : {},
        } as any,
      });

      await context.close(entity.id);
    } else {
      await context.close();
    }

    await opts.proxy.releaseProxy("dataimpulse", proxy);
  }
}

export default signup;

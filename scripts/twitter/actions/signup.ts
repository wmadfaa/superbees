import * as async from "async";
import { faker } from "@faker-js/faker";
import { merge, values } from "lodash";
import { AccountStatus, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";

import Twitter from "../../utils/twitter/src/twitter";
import Email, { EmailClass } from "../../utils/email";

async function signup(opts: script.SuperbeesScriptFunctionOptions<any>) {
  const entity = await opts.prisma.entity.findUniqueOrThrow({ where: { id: opts.entityId || opts.vars.entityId }, include: { email: true } });

  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext(entity.id, {
    driverType: "firefox",
    fingerprintOptions: { screen: { maxWidth: 1440 } },
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers((url) => values(script.constants.CACHEABLE_REGEX).some((r) => r.test(url.toString())));

  const email_page = await context.newPage();
  const $e: EmailClass = await opts.util("email", [email_page, merge(opts, { vars: { platform: entity.email.platform } })]);

  const page = await context.newPage();
  const $: Twitter = await opts.util("twitter", [page, opts]);

  const storeDB = {
    username: faker.internet.displayName({ firstName: entity.firstname, lastName: entity.lastname }).toLowerCase(),
    password: faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }) }),
    status: AccountStatus.UNKNOWN as AccountStatus,
  };

  try {
    await email_page.bringToFront();
    const email_status = await $e.login(entity.email);
    if (email_status !== EmailStatus.VERIFIED) throw `entity email is not verified: (state=${email_status})`;
    await $e.waitUntilStable();

    await page.bringToFront();
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
      [`//div[@role="dialog" and @aria-modal="true" and .//span[contains(text(),"your experience")]]`, { onfulfilled: "customise-experience-dialog", onrejected: "unknown" }],
    ]);
    if (f_state?.startsWith(`captcha:`)) await $.solveCaptcha(f_state);
    else if (f_state === "customise-experience-dialog") {
      await $.waitAndClick(`//div[@data-testid="ocfSettingsListNextButton"]`);
      await $.waitUntilStable();
      const s_f_state = await $.raceWithCaptcha([[`//input[@name="verfication_code"]`, { onfulfilled: "verification-code-input", onrejected: "unknown" }]]);
      if (s_f_state?.startsWith(`captcha:`)) await $.solveCaptcha(s_f_state);
      else if (s_f_state !== `verification-code-input`) throw `unknown flow: (state=${s_f_state}})`;
    }

    const verification_code_input = await $.waitFor(`//input[@name="verfication_code"]`);
    const sentAt = Date.now() - 10 * 1000;
    await email_page.bringToFront();
    const emailData = await $e.get_expected_email(
      async (email) => {
        console.log({ email });
        if (!("subject" in email)) return "continue";
        else if (!email.subject?.includes("your X verification")) return "jump";

        console.log({ sentAt });
        if (!("sentAt" in email)) return "continue";
        else if (Number(email.sentAt) < sentAt) return "jump";

        return "take";
      },
      async () => {
        console.log("request a refresh");
        await page.bringToFront();
        await $.waitAndClick(`//span[@role="button" and .//span[text()="Didn't receive email?"]]`);
        const dropdown_path = `//div[@data-testid="Dropdown" and .//span[text()="Didn’t receive email?"]]`;
        await $.waitFor(dropdown_path);
        await $.waitAndClick(`${dropdown_path}/div[@role="menuitem" and .//span[text()="Resend email"]]`);
        await email_page.bringToFront();
      },
    );

    const verification_code = emailData.subject?.match(/([0-9]{6}).*/)?.[1];
    if (!verification_code) throw `verification code not found in: ${JSON.stringify(emailData)}`;

    await page.bringToFront();
    await $.waitAndFill(verification_code_input, verification_code);
    await $.waitAndClick(`//div[@role="button" and .//span[text()="Next"]]`);
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

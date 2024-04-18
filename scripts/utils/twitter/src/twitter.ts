import * as async from "async";
import { authenticator } from "otplib";

import * as script from "@superbees/script";
import { Primitive } from "@superbees/script";
import { Account, AccountStatus, Email, EmailStatus } from "@prisma/client";
import { merge } from "lodash";
import { EmailClass } from "../../email";

type LoginFlow = "unknown" | "cookies" | "credentials" | "unlock";

class Twitter extends script.SuperbeesScript {
  constructor(
    protected readonly page: script.InjectedPage,
    private readonly opts: script.SuperbeesScriptUtilFunctionOptions<never>,
  ) {
    super(page);
  }

  async race_with_captcha<OF extends Primitive, OR extends Primitive>(locators: script.RaceLocator<OF, OR>[]) {
    return async.retry<OF | OR | "unknown" | "captcha:verify" | "captcha:unlock", string>({ times: 100, interval: 1000 }, async (callback) => {
      const state = await this.raceUntilLocator<OF | "captcha:verify" | "captcha:unlock", OR | "unknown">([
        ...locators,
        [`iframe#arkoseFrame`, { onfulfilled: "captcha:verify", onrejected: "unknown" }],
        [`iframe#arkose_iframe`, { onfulfilled: "captcha:unlock", onrejected: "unknown" }],
      ]);
      if (!state || state === "unknown") return callback(`retry (state=${String(state)})`);
      return callback(null, state);
    });
  }

  async solve_captcha(authLevel: string, pg = this.page) {
    authLevel = authLevel.replace(/^captcha:/, "");
    const selector = { verify: "iframe#arkoseFrame", unlock: "iframe#arkose_iframe" }[authLevel];
    const websitePublicKey = { verify: "2CB16598-CB82-4CF7-B332-5990DB66F3AB", unlock: "0152B4EB-D2DC-460A-89A1-629838B529C9" }[authLevel];
    if (!selector || !websitePublicKey) throw `unrecognised auth level of <${authLevel}>`;

    await this.waitForFrame(selector);

    const args = {
      websiteURL: "https://iframe.arkoselabs.com",
      websitePublicKey: websitePublicKey,
      funcaptchaApiJSSubdomain: "https://client-api.arkoselabs.com",
      // @ts-ignore
      userAgent: await pg.evaluate(() => navigator.userAgent),
    };

    let solution: string | null = null;

    await this.unThrow(
      async.retry({ times: 3, interval: 1000 }, async (callback) => {
        try {
          const res = await this.opts.uncaptcha.funCaptcha("capsolver", args);
          callback(null, (solution = res.solution.token));
        } catch (e) {
          callback(e as any);
        }
      }),
    );

    if (!solution) {
      await this.unThrow(
        async.retry({ times: 3, interval: 1000 }, async (callback) => {
          try {
            const res = await this.opts.uncaptcha.funCaptcha("2captcha", args);
            callback(null, (solution = res.solution.token));
          } catch (e) {
            callback(e as any);
          }
        }),
      );
    }

    if (!solution) throw `couldn't solve the captcha`;

    await pg.evaluate(
      ({ solution, selector, websitePublicKey }) => {
        const captchaMsg = JSON.stringify({ websitePublicKey, eventId: "challenge-complete", payload: { sessionToken: solution } });
        // @ts-expect-error
        document.querySelector(selector)?.contentWindow?.parent?.postMessage(captchaMsg, "*");
      },
      { solution, selector, websitePublicKey },
    );
    await this.waitUntilStable();
    await this.waitFor(selector, { state: "hidden" });
  }

  private async get_login_flow({ retry_times = 3, verify_times = 3 }: { retry_times?: number; verify_times?: number } = {}, pg = this.page, controlled = true) {
    return async.retry<LoginFlow | undefined>(retry_times, async (callback) => {
      try {
        let flow = await this.raceUntilUrl([
          [/^https:\/\/twitter\.com\/home.*/, { waitUntil: "load", onfulfilled: "cookies", onrejected: "unknown" }],
          [/^https:\/\/twitter\.com\/i\/flow\/login.*/, { waitUntil: "load", onfulfilled: "credentials", onrejected: "unknown" }],
          [/^https:\/\/twitter\.com\/account\/access.*/, { waitUntil: "load", onfulfilled: "unlock", onrejected: "unknown" }],
        ]);
        if (!controlled || !verify_times) return callback(null, flow);

        for (let i = 0; i < verify_times; i++) {
          await script.utils.sleep(3000 / i + 1);
          const [, r] = await this.unThrow(this.get_login_flow({ retry_times, verify_times }, pg, false));
          flow = r ?? "unknown";
        }

        return callback(null, flow);
      } catch (e: any) {
        return callback(e);
      }
    });
  }

  private async unlock_account(account: Partial<Account>, pg = this.page) {
    // const [isLocked] = await this.unThrow(pg.waitForURL(/^https:\/\/twitter\.com\/account\/access.*/, { waitUntil: "load" }), { onfulfilled: true, onrejected: false });
    // if (!isLocked) throw `Account ("${account.username}") is not locked`;

    const start_btn_selector = `input[type="submit"][value="Start"]`;
    let [, start_btn] = await this.unThrow(this.waitFor(start_btn_selector));

    if (!start_btn) {
      await this.unThrow(pg.reload());
      await this.waitUntilStable();
      start_btn = this.locator(start_btn_selector);
    }

    await this.waitAndClick(start_btn);
    await this.waitUntilStable();

    const captcha_or_start = await this.race_with_captcha([[start_btn_selector, { onfulfilled: "start-btn", onrejected: "unknown" }]]);
    if (!captcha_or_start || captcha_or_start === "unknown") throw `couldn't find any arkoseFrame`;

    await async.retry(5, async (callback) => {
      return this.solve_captcha(captcha_or_start).then(
        () => callback(null),
        (e) => callback(e),
      );
    });
    await this.waitUntilStable();

    const continue_btn_selector = `input[value="Continue to X"]`;
    const captcha_or_continue = await this.race_with_captcha([[continue_btn_selector, { onfulfilled: "continue-btn", onrejected: "unknown" }]]);
    if (captcha_or_continue !== "continue-btn") throw `failed to solve the captcha`;

    await this.waitAndClick(continue_btn_selector);
    await this.waitUntilStable();
  }

  async login(account: Partial<Account & { email: Email }>, pg = this.page): Promise<AccountStatus> {
    let status = account.status || AccountStatus.UNKNOWN;

    await pg.goto(`https://twitter.com/home`);
    await this.waitUntilStable(undefined, pg);
    let flow = await this.get_login_flow(undefined, pg);
    if (!flow || flow === "unknown") throw `unknown login flow (status=${flow})`;
    if (/credentials|unlock/.test(flow)) status = AccountStatus.UNKNOWN;
    if (flow === "unlock") await this.unlock_account(account, pg);
    if (flow === "credentials") {
      await this.waitAndFill(`input[name="text"]`, account.username || account.email!.username);
      await this.waitAndClick(`div[role="button"] >> text="Next"`);
      await this.waitUntilStable();

      const credentials_flow = await this.race_with_captcha([[`input[name="password"]`, { onfulfilled: "pwd-input", onrejected: "unknown" }]]);
      if (!credentials_flow || credentials_flow === "unknown") throw `unknown login with credentials flow (status=${flow})`;
      if (credentials_flow.includes("captcha")) await this.solve_captcha(credentials_flow);
      await this.waitAndFill(`input[name="password"]`, account.password!);
      await this.waitAndClick(`div[role="button"][data-testid="LoginForm_Login_Button"]`);

      await this.waitUntilStable();

      flow = await this.get_login_flow(undefined, pg);
      console.log({ flow });
      if (flow === "unlock") await this.unlock_account(account, pg);
    }

    const state = await this.raceUntilLocator([
      [pg.getByRole("dialog", { name: "Enter your verification code" }), { onfulfilled: "totop", onrejected: "unknown" }],
      [pg.getByRole("dialog", { name: "Help us keep your account safe." }), { onfulfilled: "email", onrejected: "unknown" }],
      [pg.getByRole("dialog", { name: "Check your email" }), { onfulfilled: "enter:email-code", onrejected: "unknown" }],
    ]);

    if (state === "totop") {
      await this.waitAndFill(`input[name="text"][data-testid="ocfEnterTextTextInput"]`, authenticator.generate((account.metadata as any).totop_secret_code));
      await this.waitAndClick(`div[role="button"][data-testid="ocfEnterTextNextButton"]`);
      await this.waitUntilStable();
    } else if (state === "email") {
      await this.waitAndFill(`input[name="text"][data-testid="ocfEnterTextTextInput"]`, account.email!.username);
      await this.waitAndClick(`div[role="button"][data-testid="ocfEnterTextNextButton"]`);
      await this.waitUntilStable();
    }

    if (state === "email" || state === "enter:email-code") {
      const sentAt = new Date().setUTCSeconds(0, 0);
      const verification_code_input = await this.waitFor(`input[name="text"][data-testid="ocfEnterTextTextInput"]`);
      const email_page = (await pg.context().newPage()) as script.InjectedPage;
      const $e: EmailClass = await this.opts.util("email", [email_page, merge(this.opts, { vars: { platform: account.email?.platform } })]);
      const email_status = await $e.login(account.email!);
      if (email_status !== EmailStatus.VERIFIED) throw `email account is not verified: (state=${email_status})`;

      const email_data = await $e.get_expected_email(async (email) => {
        if (!("subject" in email)) return "continue";
        else if (!email.subject?.includes("Your Twitter confirmation code is")) return "jump";

        if (!("sentAt" in email)) return "continue";
        else if (Number(email.sentAt) < sentAt) return "jump";

        return "take";
      });

      const verification_code = email_data.subject?.match(/.* code is (\w+)$/)?.[1];
      if (!verification_code) throw `verification code not found in: ${JSON.stringify(email_data)}`;

      await pg.bringToFront();
      await this.waitAndFill(verification_code_input, verification_code);
      await this.waitAndClick(`div[role="button"][data-testid="ocfEnterTextNextButton"]`);
      await this.waitUntilStable();
    }

    flow = await this.get_login_flow();
    if (!flow || flow === "unknown") throw `unknown login flow (status=${flow})`;
    console.log(flow);
    if (flow === "unlock") await this.unlock_account(account, pg);
    status = AccountStatus.VERIFIED;

    return status;
  }

  async add_2fa_auth(account: Pick<Account, "password">) {
    await async.retry(3, async (callback) => {
      try {
        await this.page.goto(`https://twitter.com/settings/account/login_verification`);
        return callback(null);
      } catch (e) {
        return callback(e as any);
      }
    });
    await this.waitUntilStable();

    await this.waitAndClick(`//label[.//span[contains(text(), 'Authentication app')]]`);
    const state = await this.raceUntilLocator(
      [
        [`//div[@role="dialog" and @aria-modal="true" and .//span[text()="Enter your password"]]`, { onfulfilled: "enter-password", onrejected: "unknown" }],
        [`//div[@role="dialog" and @aria-modal="true" and .//span[text()="Protect your account in just two steps"]]`, { onfulfilled: "2fa-info-dialog", onrejected: "unknown" }],
      ],
      undefined,
      (s) => s === "unknown",
    );
    if (state === undefined || state === "unknown") throw `unknown flow: (state=${state})`;

    if (state === "enter-password") {
      await this.waitAndFill(`//input[@name="password"]`, account.password);
      await this.waitAndClick(`//div[@role="button" and @data-testid="LoginForm_Login_Button"]`);
      await this.waitUntilStable();
    }
    await this.waitAndClick(`//div[@role="button" and @data-testid="ActionListNextButton"]`);
    await this.waitUntilStable();

    await this.waitAndClick(`//span[@role="button" and .//span[text()="Can’t scan the QR code?"]]`);
    const secret_code = await this.waitAndGetTextContent(`div[data-viewportview="true"] > div > div[dir] > span`);
    if (!secret_code) throw `couldn't get the secret_code`;
    await this.waitAndClick(`//div[@data-testid="ocfShowCodeNextLink"]`);
    await this.waitAndFill(`//input[@data-testid="ocfEnterTextTextInput"]`, authenticator.generate(secret_code));
    await this.waitAndClick(`//div[@data-testid="ocfEnterTextNextButton"]`);
    await this.waitUntilStable();
    await this.waitFor(`//div[@role="dialog" and @aria-modal="true" and .//span[text()="You’re all set"]]`);
    await this.waitAndClick(`//div[@data-testid="OCF_CallToAction_Button"]`);
    await this.waitUntilStable();
    return secret_code;
  }
}

export default Twitter;

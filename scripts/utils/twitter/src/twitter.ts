import * as async from "async";
import { authenticator } from "otplib";

import * as script from "@superbees/script";
import { Primitive } from "@superbees/script";
import { Account } from "@prisma/client";
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

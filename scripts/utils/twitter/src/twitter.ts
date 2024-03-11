import * as async from "async";

import * as script from "@superbees/script";
import { Primitive } from "@superbees/script";
class Twitter extends script.SuperbeesScript {
  constructor(
    protected readonly page: script.InjectedPage,
    private readonly opts: script.SuperbeesScriptUtilFunctionOptions<never>,
  ) {
    super(page);
  }

  async raceWithCaptcha<OF extends Primitive, OR extends Primitive>(locators: script.RaceLocator<OF, OR>[]) {
    return async.retry<OF | OR | "unknown" | "captcha:verify" | "captcha:unlock", string>({ times: 100, interval: 1000 }, async (callback) => {
      const state = await this.raceUntilLocator<OF | "captcha:verify" | "captcha:unlock", OR | "unknown">([
        ...locators,
        [`iframe#arkoseFrame`, { onfulfilled: "captcha:verify", onrejected: "unknown" }],
        [`iframe#arkose_iframe`, { onfulfilled: "captcha:unlock", onrejected: "unknown" }],
      ]);
      console.log({ state });
      if (!state || state === "unknown") return callback(`retry (state=${String(state)})`);
      return callback(null, state);
    });
  }

  async solveCaptcha(authLevel: string, pg = this.page) {
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
}

export default Twitter;

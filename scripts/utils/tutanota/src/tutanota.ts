import type * as pw from "playwright";

import * as async from "async";
import { authenticator } from "otplib";
import { Email, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";
import { Primitive, PWwaitForOptions, PWwaitForURLOptions, PWwaitForURLUrl } from "@superbees/script";
import captchaSolver from "./captcha-solver";

class Tutanota extends script.SuperbeesScript {
  constructor(
    protected readonly page: script.InjectedPage,
    private readonly opts: script.SuperbeesScriptUtilFunctionOptions<never>,
  ) {
    super(page);
  }

  async go_to_root_if_needed() {
    await this.waitUntilStable();
    if (!(await this.unThrow(this.waitFor(`//div[@id="login-view"]`, { timeout: 100 }), { onfulfilled: true, onrejected: false }))) {
      await async.retry({ times: 5, interval: 200 }, async (callback) => {
        const response = await this.page.goto("https://app.tuta.com");
        if (response?.status() !== 200) callback(new Error("failed to load page"));
        callback(null);
      });
      await this.waitUntilStable();
    }
  }

  async login(email: Pick<Email, "username" | "password" | "metadata">) {
    await this.go_to_root_if_needed();

    const login_with_credentials_button = `//button[@title="Log in"]`;
    const should_login_with_credentials = await this.raceUntilLocator([
      [login_with_credentials_button, { onfulfilled: true, onrejected: "unknown" }],
      [`//button[@title="${email.username}"]`, { onfulfilled: false, onrejected: "unknown" }],
    ]);

    if (should_login_with_credentials) {
      await this.waitAndFill(`//div[@id="login-view"]//input[@aria-label="Email address"]`, email.username);
      await this.waitAndFill(`//div[@id="login-view"]//input[@aria-label="Password"]`, email.password);
      await this.waitAndClick(`//label[contains(text(),"Store password")]/input`);
      await this.waitAndClick(login_with_credentials_button);

      await this.wait_for_logging_in();

      const authenticator_code_input = `//input[@aria-label="Authenticator code"]`;
      const state = await this.race_with_email_state([
        [
          `//div[@role="dialog" and .//p[contains(text(),"Please authenticate with your second factor")] and .${authenticator_code_input}]`,
          { onfulfilled: "2fa", onrejected: EmailStatus.UNKNOWN },
        ],
      ]);
      if (state !== "2fa") return state;

      const { totopSecretKey } = (email.metadata ?? {}) as Record<string, string>;
      if (!totopSecretKey) throw new Error("email.metadata.totopSecretKey is missing");

      await this.waitAndFill(authenticator_code_input, authenticator.generate(totopSecretKey));
      await this.waitAndClick(`//button[@title="Ok"]`);
    }

    await this.wait_for_logging_in();

    return this.race_with_email_state();
  }

  async solve_captcha() {
    await async.retry({ times: 3, interval: 200 }, async (callback) => {
      const image_locator = await this.waitFor(`//img[@alt="Captcha"]`);
      const image_url = await image_locator.getAttribute("src");
      if (!image_url) return callback(new Error(`tutanota-captcha src is missing`));
      const image_buffer = Buffer.from(image_url.replace(/^data:image\/\w+;base64,/, ""), "base64");
      const prediction = await captchaSolver(image_buffer);
      await this.waitAndFill(`//input[@aria-label="Time (hh:mm)"]`, prediction);
      await this.waitAndClick(`//button[@title="Ok"]`);
      await this.waitUntilStable();

      const state = await this.raceUntilLocator([
        [`//div[@id="dialog-title" and .//*[contains(text(),"Unfortunately, the answer is wrong")]]`, { onfulfilled: "wrong-captcha-prediction", onrejected: "unknown" }],
        [`//div[@id="dialog-title" and .//*[contains(text(),"Registration is temporarily blocked")]]`, { onfulfilled: "blocked", onrejected: "unknown" }],
        [`//div[@id="dialog-title" and .//*[text()="Congratulations"]]`, { onfulfilled: "congratulations", onrejected: "unknown" }],
      ]);

      if (state === "congratulations") return callback(null);
      return callback(new Error(`resolved with the state: [ ${state} ]`));
    });
  }
  /* private methods */
  private async race_with_email_state<OF extends Primitive = undefined, OR extends Primitive = undefined>(
    locators: [locator: pw.Locator | string, options: PWwaitForOptions & { onfulfilled: OF; onrejected?: OR }][] = [],
    urls: [url: PWwaitForURLUrl, options: PWwaitForURLOptions & { onfulfilled: OF; onrejected?: OR }][] = [],
    pg = this.page,
  ) {
    const not_allowed_to_exchange_emails_locator = `//div[@role="dialog" and contains(text(), "Sorry, you are currently not allowed to send or receive emails")]`;
    return this.raceUntilLocatorOrUrl<OF | EmailStatus, OR | EmailStatus>(
      [
        ...locators,
        [`//small[./*[text()="Invalid login credentials. Please try again."]]`, { onfulfilled: EmailStatus.BLOCKED, onrejected: EmailStatus.UNKNOWN }],
        [`/html[.//div[@id="mail"] and .${not_allowed_to_exchange_emails_locator}]`, { onfulfilled: EmailStatus.PENDING, onrejected: EmailStatus.UNKNOWN }],
        [`/html[.//div[@id="mail"] and not(.${not_allowed_to_exchange_emails_locator})]`, { onfulfilled: EmailStatus.VERIFIED, onrejected: EmailStatus.UNKNOWN }],
      ],
      [...urls],
      pg,
    );
  }
  private async wait_for_logging_in() {
    await this.trackLocatorStateUntil(`//p[@id="dialog-title" and .//text()="Logging in ..."]`, { state: ["hidden"] });
    await this.waitUntilStable();
  }
}

export default Tutanota;

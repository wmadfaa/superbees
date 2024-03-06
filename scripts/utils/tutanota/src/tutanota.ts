import * as async from "async";
import { Email, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";
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
      this.opts.logger.info(`enter account credentials`);
      await this.waitAndFill(`//div[@id="login-view"]//input[@aria-label="Email address"]`, email.username);
      await this.waitAndFill(`//div[@id="login-view"]//input[@aria-label="Password"]`, email.password);
      await this.waitAndClick(`//label[contains(text(),"Store password")]/input`);
      await this.waitAndClick(login_with_credentials_button);
    } else {
      this.opts.logger.info(`login with the account pre stored cookies`);
    }

    await this.trackLocatorStateUntil(`//p[@id="dialog-title" and .//text()="Logging in ..."]`, { state: ["hidden"] });

    return async.retry<EmailStatus>({ times: 100, interval: 1000 }, async (callback) => {
      const not_allowed_to_exchange_emails_locator = `//div[@id="dialog-message" and .//*[contains(text(), "Sorry, you are currently not allowed to send or receive emails")]]`;
      const state = await this.raceUntilLocator([
        [`//small[contains(text(), "Invalid login credentials. Please try again.")]`, { onfulfilled: EmailStatus.BLOCKED, onrejected: EmailStatus.UNKNOWN }],
        [`//div[@id="root" and ./div[@id="mail"] and .${not_allowed_to_exchange_emails_locator}]`, { onfulfilled: EmailStatus.PENDING, onrejected: EmailStatus.UNKNOWN }],
        [`//div[@id="root" and ./div[@id="mail"] and not(.${not_allowed_to_exchange_emails_locator})]`, { onfulfilled: EmailStatus.VERIFIED, onrejected: EmailStatus.UNKNOWN }],
      ]);
      if (state === EmailStatus.UNKNOWN) return callback(new Error(`resolved with [UNKNOWN] EmailStatus`));
      return callback(null, state);
    });
  }

  async solve_captcha() {
    const image_locator = await this.waitFor(`//img[@alt="Captcha"]`);
    const image_url = await image_locator.getAttribute("src");
    if (!image_url) throw `tutanota-captcha src is missing`;

    const image_buffer = Buffer.from(image_url.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const prediction = await captchaSolver(image_buffer);
    await this.waitAndFill(`//input[@aria-label="Time (hh:mm)"]`, prediction);
    await this.waitAndClick(`//button[@title="Ok"]`);

    await this.waitUntilStable();

    const state = await this.trackLocatorStateUntil(`//p[@id='dialog-title' and .//text()="Preparing account ..."]`, {
      state: ["wrong-captcha-prediction", "blocked", "congratulations"],
      extra_locators: [
        [`//div[@id="dialog-title" and .//*[contains(text(),"Unfortunately, the answer is wrong")]]`, { onfulfilled: "wrong-captcha-prediction", onrejected: "unknown" }],
        [`//div[@id="dialog-title" and .//*[contains(text(),"Registration is temporarily blocked")]]`, { onfulfilled: "blocked", onrejected: "unknown" }],
        [`//div[@id="dialog-title" and .//*[text()="Congratulations"]]`, { onfulfilled: "congratulations", onrejected: "unknown" }],
      ],
    });

    if (state !== "congratulations") throw `resolved with the state: [ ${state} ]`;
  }
}

export default Tutanota;

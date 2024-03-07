import * as async from "async";
import { Email, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";
import captchaSolver from "./captcha-solver";

export interface TutanotaEmailData {
  sentAt: Date;
  subject: string;
  sender_name: string;
  sender_email_address: string;
  body: string;
}

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
      return true;
    }
    return false;
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

  async get_expected_email(
    filter: (data: Partial<TutanotaEmailData>) => Promise<"take" | "jump" | "continue">,
    options: async.RetryOptions<Error> = { times: 180, interval: 1000 },
    take = 5,
    pg = this.page,
  ) {
    const inbox_list_path = `//div[@aria-label="Inbox"]//ul`;
    await this.waitFor(inbox_list_path);
    let prev_inbox_items_count: number;
    return async.retry<Partial<TutanotaEmailData>>(options, async (callback) => {
      const inbox_items_path = `${inbox_list_path}/li[not(contains(@style, 'display: none'))]`;
      const inbox_items_count = await pg.locator(inbox_items_path).count();
      if (!inbox_items_count) return callback(new Error(`the inbox list is empty`));
      else if (prev_inbox_items_count && inbox_items_count === prev_inbox_items_count) return callback(Error(`the emails count haven't increase from the last check`));
      prev_inbox_items_count = inbox_items_count;

      let result: null | Partial<TutanotaEmailData> = null;

      for (let i = 0; i <= Math.min(take, inbox_items_count); i++) {
        const inbox_item_path = `(${inbox_items_path})[${i}]`;

        const sender_name = (await pg.locator(`${inbox_item_path}//div[contains(@class, "text-ellipsis") and not(contains(@class,"smaller"))]`).textContent()) ?? undefined;
        const subject = (await pg.locator(`(${inbox_items_path})[${i}]//div[contains(@class, "text-ellipsis") and contains(@class,"smaller")]`).textContent()) ?? undefined;

        const na1 = await filter({ sender_name });
        if (na1 === "take") {
          result = { sender_name, subject };
          break;
        } else if (na1 === "jump") {
          continue;
        }

        await this.waitAndClick(inbox_items_path, undefined, pg);
        await this.waitUntilStable(undefined, pg);

        const email_details_path = `//div[contains(@class,"header")]//div[@role="button" and position()=2]`;

        const sender_email_address = (await pg.locator(`${email_details_path}//span[contains(@class,"text-break")]`).textContent()) ?? undefined;
        const sentAt = await pg.locator(`//div[contains(@class,"noscreen")]`).evaluate((node) => {
          if (!node.textContent) throw `no text content`;
          const parts = node.textContent.split(" • ");
          const datePart = parts[0];
          const timePart = parts[1];
          const [hours, minutes] = timePart.split(":").map(Number);

          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          let day, month, year;

          const dayMonthYearMatch = datePart.match(/\w+, (\d{1,2}) (\w+) (\d{4})/);
          const monthDayYearMatch = datePart.match(/\w+, (\w+) (\d{1,2}), (\d{4})/);

          if (dayMonthYearMatch) {
            day = parseInt(dayMonthYearMatch[1], 10);
            month = monthNames.indexOf(dayMonthYearMatch[2]);
            year = parseInt(dayMonthYearMatch[3], 10);
          } else if (monthDayYearMatch) {
            month = monthNames.indexOf(monthDayYearMatch[1]);
            day = parseInt(monthDayYearMatch[2], 10);
            year = parseInt(monthDayYearMatch[3], 10);
          } else {
            throw new Error("Date string format not recognized.");
          }

          return new Date(year, month, day, hours, minutes);
        });
        const body = (await pg.locator(`//div[@id="mail-body"]`).evaluate((node) => node.shadowRoot?.innerHTML)) ?? undefined;

        const na2 = await filter({ sender_name });
        if (na2 === "take") {
          result = { sender_name, subject, sender_email_address, sentAt, body };
          break;
        } else {
          result = null;
        }
      }
      if (!result) return callback(Error(`target not found`));

      callback(null, result);
    });
  }
}

export default Tutanota;

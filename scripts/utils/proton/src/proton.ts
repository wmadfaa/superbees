import * as async from "async";
import { merge } from "lodash";
import { Email, EmailStatus } from "@prisma/client";

import * as script from "@superbees/script";
import captchaSolver from "./captcha-solver";

export interface ProtonEmailData {
  sentAt: number;
  subject: string;
  sender_name: string;
  sender_email_address: string;
  body: string;
}

class Proton extends script.SuperbeesScript {
  constructor(
    protected readonly page: script.InjectedPage,
    private readonly opts: script.SuperbeesScriptUtilFunctionOptions<unknown>,
  ) {
    super(page);
  }
  async login(email: Pick<Email, "username" | "password">) {
    await this.page.goto("https://account.proton.me/login");
    const state = await async.retry<string, string>({ times: 20, interval: 1000 }, async (callback) => {
      const $state = await this.raceUntilLocator([
        [`//p[text()="Loading Proton Account"]`, { onfulfilled: "loading", onrejected: "unknown", timeout: 100 }],
        [`//*[contains(text(),"Loading Proton Mail")]`, { onfulfilled: "loading", onrejected: "unknown", timeout: 100 }],
        [`//h1[text()="Sign in"]`, { onfulfilled: "login:form", onrejected: "unknown", timeout: 100 }],
        [`//button[@data-testid="heading:userdropdown"]`, { onfulfilled: "mail:app", onrejected: "unknown", timeout: 100 }],
      ]);
      if ($state && /login:form|mail:app/.test($state)) return callback(null, $state);
      return callback(`retry (state=${$state})`);
    });
    if (!/login:form|mail:app/.test(state)) throw `unknown flow`;
    if (state === "login:form") {
      await this.waitAndFill(`//input[@id="username"]`, email.username);
      await this.waitAndFill(`//input[@id="password"]`, email.username);
      await this.waitAndClick(`//input[@id="staySignedIn"]`);
      await this.waitAndClick(`//button[text()="Sign in"]`);
      await this.unThrow(this.waitFor(`//button[text()="Signing in" and @aria-busy="true"]`, { state: "hidden" }));
    }
    await this.waitUntilStable();
    const status = await this.raceUntilLocator([
      [`//*[contains(text(),"Loading Proton Mail")]`, { onfulfilled: "mail:app:loading", onrejected: "unknown", timeout: 300 }],
      [`//button[@data-testid="heading:userdropdown"]`, { onfulfilled: "mail:app", onrejected: "unknown", timeout: 300 }],
    ]);
    if (!status) return EmailStatus.UNKNOWN;
    if (!/mail:app:loading|mail:app/.test(status)) return EmailStatus.BLOCKED;
    return EmailStatus.VERIFIED;
  }

  async solve_captcha() {
    const challengePromise = this.page.waitForResponse(/http(s?):\/\/account-api.proton.me\/captcha\/v1\/api\/init.*/, { timeout: 30000 });
    const imagePromise = this.page.waitForResponse(/http(s?):\/\/account-api.proton.me\/captcha\/v1\/api\/bg\?token=.*/, { timeout: 30000 });

    const puzel = await imagePromise.then((r) => r.body());
    const challenges = await challengePromise.then((r) => r.json().then((v: Record<string, string[]>) => v?.challenges));

    const payload = await captchaSolver(puzel, challenges);

    await this.page.route(/^https:\/\/account-api.proton.me\/captcha\/v1\/api\/validate.*$/, async (route, request) => {
      await route.continue({ headers: merge(await request.allHeaders(), { Pcaptcha: JSON.stringify(payload) }) });
    });

    const iframe = this.page.frame({ name: "pcaptcha" });
    if (!iframe) throw `pcaptcha iframe is missing`;
    await this.waitAndClick(iframe.locator(`//button[text()="Next"]`));
  }

  wait_for_loading<OF extends script.Primitive, OR extends script.Primitive>([loader, target]: [loader: script.RaceLocator<OF, OR>, target: script.RaceLocator<OF, OR>]) {
    return async.retry<OF | OR, string>({ times: 20, interval: 1000 }, async (callback) => {
      const state = await this.raceUntilLocator<OF | "refresh", OR | "unknown">([
        loader,
        [`button >> text="Refresh the page"`, { onfulfilled: "refresh", onrejected: "unknown" }],
        [`button >> text="refresh the page"`, { onfulfilled: "refresh", onrejected: "unknown" }],
        target,
      ]);

      if (!state || /refresh|unknown/.test(String(state)) || state == loader[1].onfulfilled) {
        if (state === "refresh") await this.unThrow(this.page.reload());
        return callback("retry");
      }
      return callback(null, state as OF | OR);
    });
  }

  async get_expected_email(
    filter: (data: Partial<ProtonEmailData>) => Promise<"take" | "jump" | "continue">,
    options: async.RetryOptions<string> = { times: 180, interval: 1000 },
    take = 5,
  ) {
    const inbox_items_path = `//div[@data-shortcut-target="item-container-wrapper"]`;
    await this.waitFor(`${inbox_items_path}/..`);
    let prev_inbox_items_count: number;
    return async.retry<Partial<ProtonEmailData>, string>(options, async (callback) => {
      const inbox_items_count = await this.locator(inbox_items_path).count();
      if (!inbox_items_count) return callback(`the inbox list is empty`);
      else if (prev_inbox_items_count && inbox_items_count === prev_inbox_items_count) return callback(`the emails count haven't increase from the last check`);
      prev_inbox_items_count = inbox_items_count;
      let result: null | Partial<ProtonEmailData> = null;

      for (let i = 0; i <= Math.min(take, inbox_items_count); i++) {
        const inbox_item_path = `(${inbox_items_path})[${i + 1}]`;
        const sender_name = (await this.waitAndGetTextContent(`${inbox_item_path}//span[@data-testid="message-column:sender-address"]`)) ?? undefined;
        const subject = (await this.waitAndGetTextContent(`${inbox_item_path}//span[@data-testid="message-row:subject"]`)) ?? undefined;

        const na1 = await filter({ sender_name, subject });
        if (na1 === "take") {
          result = { sender_name, subject };
          break;
        } else if (na1 === "jump") {
          continue;
        }

        await this.waitAndClick(inbox_items_path);
        await this.waitUntilStable();

        const sender_email_address = (await this.waitAndGetTextContent(`//span[@data-testid="recipient-address"]`)) ?? undefined;

        await this.unThrow(this.waitAndClick(`//button[@data-testid="message-show-details" and @aria-expanded="false"]`));

        const sentAt = await this.locator(`//time[@data-testid="item-date-full"]`).evaluate((node) => {
          if (!node.textContent) throw `no text content`;
          const [, day, month, year, time] = node.textContent.match(/(\d+) (\w+) (\d+) at (\d+:\d+)/)!;

          const months = {
            January: 0,
            February: 1,
            March: 2,
            April: 3,
            May: 4,
            June: 5,
            July: 6,
            August: 7,
            September: 8,
            October: 9,
            November: 10,
            December: 11,
          };

          // @ts-ignore
          const date = new Date(Number(year), months[month], day, ...time.split(":").map(Number));

          return date.getTime();
        });

        const frame = await this.waitForFrame(`//iframe[@title="Email content"]`);
        const body = await frame.locator("body").innerHTML();

        const na2 = await filter({ sender_name });
        if (na2 === "take") {
          result = { sender_name, subject, sender_email_address, sentAt, body };
          break;
        } else {
          result = null;
        }
      }
      if (!result) return callback(`target not found`);

      callback(null, result);
    });
  }
}

export default Proton;

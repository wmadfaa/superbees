import * as async from "async";
import { Email } from "@prisma/client";

import * as script from "@superbees/script";
import captchaSolver from "./captcha-solver";
import { merge } from "lodash";

export interface ProtonEmailData {
  sentAt: Date;
  subject: string;
  sender_name: string;
  sender_email_address: string;
  body: string;
}

class Proton extends script.SuperbeesScript {
  constructor(
    protected readonly page: script.InjectedPage,
    private readonly opts: script.SuperbeesScriptUtilFunctionOptions<never>,
  ) {
    super(page);
  }

  async login(email: Pick<Email, "username" | "password" | "metadata">) {}

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

  async get_expected_email(
    filter: (data: Partial<ProtonEmailData>) => Promise<"take" | "jump" | "continue">,
    options: async.RetryOptions<Error> = { times: 180, interval: 1000 },
    take = 5,
    pg = this.page,
  ) {}
}

export default Proton;

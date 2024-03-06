import type * as pw from "playwright";

import * as async from "async";
import { InjectedPage } from "@superbees/browser";
import { merge } from "lodash";

export type Primitive = string | number | boolean | bigint | symbol | null | undefined | Primitive[];
export type PWwaitForOptions = Parameters<pw.Locator["waitFor"]>[0];
export type PWwaitForURLUrl = Parameters<pw.Page["waitForURL"]>[0];
export type PWwaitForURLOptions = Parameters<pw.Page["waitForURL"]>[1];

type PWLocatorState = "attached" | "detached" | "visible" | "hidden";
export interface TrackLocatorSateUntilOptions<OF extends Primitive, OR extends Primitive> {
  retry?: async.RetryOptions<Error>;
  state: (OF | OR | PWLocatorState)[];
  timeout?: number;
  escape_sticky_state_after?: number;
  extra_locators?: [locator: pw.Locator | string, options: PWwaitForOptions & { onfulfilled: OF; onrejected?: OR }][];
}
export class SuperbeesScript {
  constructor(protected page: InjectedPage) {}

  public async unThrow<T, OF extends Primitive, OR extends Primitive>(promise: Promise<T>, msg: { onfulfilled?: OF; onrejected?: OR } = {}) {
    return promise.then(
      (r) => msg.onfulfilled,
      (e) => msg.onrejected,
    );
  }

  public async waitUntilStable(timeout = 2000, pg = this.page) {
    await this.unThrow(pg.waitForLoadState("load", { timeout }));
    await this.unThrow(pg.waitForLoadState("domcontentloaded", { timeout: timeout / 2 }));
    await this.unThrow(pg.waitForLoadState("networkidle", { timeout: timeout / 3 }));
  }

  public async waitFor(locator: pw.Locator | string, options?: PWwaitForOptions, pg = this.page) {
    locator = this.locator(locator);
    await locator.waitFor(options);
    return locator;
  }

  public async waitAndClick(locator: pw.Locator | string, options?: PWwaitForOptions, pg = this.page) {
    locator = await this.waitFor(locator, options, pg);
    await this.unThrow(locator.scrollIntoViewIfNeeded({ timeout: options?.timeout }));
    await locator.isEnabled({ timeout: options?.timeout });
    await locator.click();
  }

  public async waitAndFill(locator: pw.Locator | string, value: string | number, options?: PWwaitForOptions, pg = this.page) {
    locator = await this.waitFor(locator, options, pg);
    await this.unThrow(locator.scrollIntoViewIfNeeded({ timeout: options?.timeout }));
    await locator.isEditable({ timeout: options?.timeout });
    await locator.clear();
    await locator.fill(value.toString());
    await this.unThrow(locator.blur());
  }

  public async waitAndSelectOption(locator: pw.Locator | string, value: string | number, options?: PWwaitForOptions, pg = this.page) {
    locator = await this.waitFor(locator, options, pg);
    await this.unThrow(locator.scrollIntoViewIfNeeded({ timeout: options?.timeout }));
    await locator.isEnabled({ timeout: options?.timeout });
    await locator.selectOption(value.toString());
  }

  public async clickIfVisible(locator: pw.Locator | string, pg = this.page) {
    locator = this.locator(locator);
    if (await locator.isVisible()) await locator.click();
  }

  public async raceUntilLocator<OF extends Primitive, OR extends Primitive>(
    locators: [locator: pw.Locator | string, options: PWwaitForOptions & { onfulfilled: OF; onrejected?: OR }][],
    pg = this.page,
  ) {
    return Promise.race(
      locators.map(([l, o], i, a) =>
        this.waitFor(l, merge({ timeout: (o.timeout ?? 3000) + (a.length - i) * 10 }, o), pg).then(
          () => o.onfulfilled,
          () => o.onrejected,
        ),
      ),
    );
  }

  public async raceUntilUrl<OF extends Primitive, OR extends Primitive>(
    urls: [url: PWwaitForURLUrl, options: PWwaitForURLOptions & { onfulfilled: OF; onrejected?: OR }][],
    pg = this.page,
  ) {
    return Promise.race(
      urls.map(([u, o], i, a) =>
        pg.waitForURL(u, merge({ timeout: (o.timeout ?? 3000) + (a.length - i) * 10 }, o)).then(
          () => o.onfulfilled,
          () => o.onrejected,
        ),
      ),
    );
  }

  public async raceUntilLocatorOrUrl<OF extends Primitive, OR extends Primitive>(
    locators: [locator: pw.Locator | string, options: PWwaitForOptions & { onfulfilled: OF; onrejected?: OR }][],
    urls: [url: PWwaitForURLUrl, options: PWwaitForURLOptions & { onfulfilled: OF; onrejected?: OR }][],
    pg = this.page,
  ) {
    return Promise.race(
      locators
        .map(([l, o], i, a) =>
          this.waitFor(l, merge({ timeout: (o.timeout ?? 3000) + (a.length - i) * 10 }, o), pg).then(
            () => o.onfulfilled,
            () => o.onrejected,
          ),
        )
        .concat(
          urls.map(([u, o], i, a) =>
            pg.waitForURL(u, merge({ timeout: (o.timeout ?? 3000) + (a.length - i) * 10 }, o)).then(
              () => o.onfulfilled,
              () => o.onrejected,
            ),
          ),
        ),
    );
  }

  public async trackLocatorStateUntil<OF extends Primitive, OR extends Primitive>(
    locator: pw.Locator | string,
    { retry = { times: 100, interval: 1000 }, timeout = 100, state, escape_sticky_state_after = 10, extra_locators = [] }: TrackLocatorSateUntilOptions<OF, OR>,
    pg = this.page,
  ) {
    locator = this.locator(locator, pg);
    let prev_captured_state: any;
    let sticky_count = 0;
    return await async.retry<OF | PWLocatorState | OR | "unknown">(retry, async (callback) => {
      const last_captured_state = await this.raceUntilLocator<OF | PWLocatorState, OR | "unknown">(
        [
          ...extra_locators,
          [locator, { onfulfilled: "visible", onrejected: "unknown", state: "visible", timeout }],
          [locator, { onfulfilled: "attached", onrejected: "unknown", state: "attached", timeout }],
          [locator, { onfulfilled: "hidden", onrejected: "unknown", state: "hidden", timeout }],
          [locator, { onfulfilled: "detached", onrejected: "unknown", state: "detached", timeout }],
        ],
        pg,
      );
      if (prev_captured_state === last_captured_state) {
        if (sticky_count >= (escape_sticky_state_after || retry?.times || Infinity) + 1) return callback(new Error(`escaped sticky state [${state}] after ${sticky_count}`));
        sticky_count += 1;
      } else {
        sticky_count = 0;
      }
      if (prev_captured_state && state.some((s) => s === last_captured_state)) return callback(null, last_captured_state);
      prev_captured_state = last_captured_state;
      return callback(new Error(`trackLocatorSateUntil: (${locator}) expected [${state}] got [${String(last_captured_state)}]`));
    });
  }

  private locator(locator: pw.Locator | string, pg = this.page) {
    if (typeof locator === "string") locator = pg.locator(locator);
    return locator;
  }
}

export * from "./src/types";
export * as utils from "./src/utils";
export default SuperbeesScript;

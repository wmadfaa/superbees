import type * as pw from "playwright";

import { InjectedPage } from "@superbees/browser";

export type Primitive = string | number | boolean | bigint | symbol | null | undefined | Primitive[];
export type PWwaitForOptions = Parameters<pw.Locator["waitFor"]>[0];
export type PWwaitForURLUrl = Parameters<pw.Page["waitForURL"]>[0];
export type PWwaitForURLOptions = Parameters<pw.Page["waitForURL"]>[1];

class SuperbeesScript {
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
    if (typeof locator === "string") locator = pg.locator(locator);
    await locator.first().waitFor(options);
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
    if (typeof locator === "string") locator = pg.locator(locator);
    if (await locator.isVisible()) await locator.click();
  }

  public async raceUntilLocator<OF extends Primitive, OR extends Primitive>(
    locators: [locator: pw.Locator | string, options: PWwaitForOptions & { onfulfilled: OF; onrejected?: OR }][],
    pg = this.page,
  ) {
    return Promise.race(
      locators.map(([l, o]) =>
        this.waitFor(l, o, pg).then(
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
      urls.map(([u, o]) =>
        pg.waitForURL(u, o).then(
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
        .map(([l, o]) =>
          this.waitFor(l, o, pg).then(
            () => o.onfulfilled,
            () => o.onrejected,
          ),
        )
        .concat(
          urls.map(([u, o]) =>
            pg.waitForURL(u, o).then(
              () => o.onfulfilled,
              () => o.onrejected,
            ),
          ),
        ),
    );
  }
}

export * from "./src/types";
export * as utils from "./src/utils";
export default SuperbeesScript;

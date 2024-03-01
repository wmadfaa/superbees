import type * as pw from "playwright";
import type * as fp from "./fingerprint";

import { create, merge } from "lodash";

import browsers, { SuperbeesBrowserType } from "./stealth";
import { newInjectedContext, newInjectedPersistentContext } from "./fingerprint";

export interface SuperbeesContextOptions extends fp.NewInjectedContextOptions {
  driverType: SuperbeesBrowserType;
}

export interface SuperbeesPersistentContextOptions extends fp.NewInjectedPersistentContextOptions {
  driverType: SuperbeesBrowserType;
}

export type SuperbeesContext = fp.InjectedContext & {
  close(entityId?: string, options?: { reason?: string }): Promise<void>;
};

class SuperbeesBrowser {
  private browsers = new Map<SuperbeesBrowserType, pw.Browser>();

  constructor(private browserLaunchOptions: Partial<Record<SuperbeesBrowserType, pw.LaunchOptions>> = {}) {}

  private async launch(type: SuperbeesBrowserType) {
    const browser = this.browsers.get(type);

    if (browser) return browser;
    return this.browsers.set(type, await browsers[type].launch(merge(this.browserLaunchOptions[type], { env: { PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: "1" } }))).get(type)!;
  }

  private makeContextClose(context: fp.InjectedContext, defaultEntityId: string) {
    return async (entityId = defaultEntityId, options?: Parameters<fp.InjectedContext["close"]>[0]) => {
      if (entityId) {
        const geolocation = context.geolocation;
        const fingerprint = context.fingerprint;
        const storageState = await context.storageState();
      }
      return context.close(options);
    };
  }

  async newContext(entityId: string, { driverType, ...options }: SuperbeesContextOptions): Promise<SuperbeesContext> {
    const context = await newInjectedContext(await this.launch(driverType), options);
    const close = this.makeContextClose(context, entityId);
    return create(context, { close });
  }

  async newPersistentContext(entityId: string, { driverType, ...options }: SuperbeesPersistentContextOptions): Promise<SuperbeesContext> {
    options.browserContextOptions = merge(this.browserLaunchOptions, options.browserContextOptions);

    const context = await newInjectedPersistentContext(browsers[driverType], options);
    const close = this.makeContextClose(context, entityId);
    return create(context, { close });
  }

  async close(type?: SuperbeesBrowserType) {
    if (type) return this.browsers.get(type)?.close();

    for (const browser of this.browsers.values()) {
      await browser.close();
    }
    this.browsers.clear();
  }
}

export default SuperbeesBrowser;

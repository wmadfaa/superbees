import type * as pw from "playwright";
import type * as fp from "./fingerprint";

import { Prisma, PrismaClient } from "@prisma/client";
import { create, merge } from "lodash";

import browsers, { SuperbeesBrowserType } from "./stealth";
import { newInjectedContext, newInjectedPersistentContext } from "./fingerprint";

interface BaseSuperbeesContextOptions {
  driverType: SuperbeesBrowserType;
}

export interface SuperbeesContextOptions extends fp.NewInjectedContextOptions, BaseSuperbeesContextOptions {}

export interface SuperbeesPersistentContextOptions extends fp.NewInjectedPersistentContextOptions, BaseSuperbeesContextOptions {}

export type SuperbeesContext = fp.InjectedContext & {
  close(entityId?: string, options?: { reason?: string }): Promise<void>;
};

class SuperbeesBrowser {
  private browsers = new Map<SuperbeesBrowserType, pw.Browser>();
  private prisma: PrismaClient;

  constructor(private browserLaunchOptions: Partial<Record<SuperbeesBrowserType, pw.LaunchOptions>> = {}) {
    this.prisma = new PrismaClient();
  }

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
        await this.prisma.entity.update({ where: { id: entityId }, data: { browser: { geolocation, storageState, fingerprint } } as Prisma.InputJsonObject });
      }
      return context.close(options);
    };
  }

  private makeRegisterCachingHandlerFunction(context: SuperbeesContext) {
    return async (url: Parameters<SuperbeesContext["route"]>[0]) => {
      await context.route(url, (route, request) => {
        console.log(request.resourceType());
        route.fulfill();
        route.continue();
      });
      context.on("response", (response) => {
        console.log(response.url());
      });
    };
  }

  private makeUnregisterCachingHandlerFunction(context: SuperbeesContext) {
    return async (url: Parameters<SuperbeesContext["route"]>[0]) => {
      await context.unroute(url);
    };
  }

  private async fetchEntityBrowser<T extends {}>(entityId: string, { ...options }: T) {
    let entity_browser: Prisma.JsonObject | undefined;
    if (entityId) {
      const entity = await this.prisma.entity.findUniqueOrThrow({ where: { id: entityId }, select: { browser: true } });
      if (entity.browser) entity_browser = entity.browser as Prisma.JsonObject;
      options = merge(options, {
        fingerprint: entity_browser?.fingerprint,
        browserContextOptions: { storageState: entity_browser?.storageState, geolocation: entity_browser?.geolocation },
      });
    }
    return options;
  }

  async newContext(entityId: string, { driverType, ...options }: SuperbeesContextOptions): Promise<SuperbeesContext> {
    options = await this.fetchEntityBrowser(entityId, options);

    const context = await newInjectedContext(await this.launch(driverType), options);
    const close = this.makeContextClose(context, entityId);
    const registerCachingHandler = this.makeRegisterCachingHandlerFunction(context);
    const unregisterCachingHandler = this.makeUnregisterCachingHandlerFunction(context);
    return create(context, { close, registerCachingHandler, unregisterCachingHandler });
  }

  async newPersistentContext(entityId: string, { driverType, ...options }: SuperbeesPersistentContextOptions): Promise<SuperbeesContext> {
    options = await this.fetchEntityBrowser(entityId, options);
    options.browserContextOptions = merge(this.browserLaunchOptions, options.browserContextOptions);

    const context = await newInjectedPersistentContext(browsers[driverType], options);
    const close = this.makeContextClose(context, entityId);
    const registerCachingHandler = this.makeRegisterCachingHandlerFunction(context);
    const unregisterCachingHandler = this.makeUnregisterCachingHandlerFunction(context);
    return create(context, { close, registerCachingHandler, unregisterCachingHandler });
  }

  async close(type?: SuperbeesBrowserType) {
    if (type) return this.browsers.get(type)?.close();

    for (const browser of this.browsers.values()) {
      await browser.close();
    }
    this.browsers.clear();
  }
}

export type * from "./stealth";
export type * from "./fingerprint";
export default SuperbeesBrowser;

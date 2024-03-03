import type * as pw from "playwright";
import type * as fg from "fingerprint-generator";

import { merge, create } from "lodash";
import { FingerprintGenerator } from "fingerprint-generator";

import browsers, { SuperbeesBrowserType } from "../stealth";
import FingerprintInjector from "./fingerprint-Injector";
import { BrowserContext } from "playwright";

type PwStorageState = Awaited<ReturnType<pw.BrowserContext["storageState"]>>;
type PwLaunchPersistentContext = Parameters<(typeof browsers)[SuperbeesBrowserType]["launchPersistentContext"]>[1];

interface BaseContextOptions {
  fingerprint?: fg.BrowserFingerprintWithHeaders;
  fingerprintOptions?: Partial<fg.FingerprintGeneratorOptions>;
}

export interface NewInjectedContextOptions extends BaseContextOptions {
  browserContextOptions?: pw.BrowserContextOptions;
}

export interface NewInjectedPersistentContextOptions extends BaseContextOptions {
  browserContextOptions?: Partial<PwLaunchPersistentContext> & { storageState?: PwStorageState };
}

export interface InjectedContext extends pw.BrowserContext {
  fingerprint?: fg.BrowserFingerprintWithHeaders;
  geolocation?: pw.Geolocation;
  newPage(): Promise<InjectedPage>;
}

export interface InjectedPage extends pw.Page {
  storageState: InjectedContext["storageState"];
  fingerprint?: fg.BrowserFingerprintWithHeaders;
  geolocation?: pw.Geolocation;
}
export async function newInjectedContext(browser: pw.Browser, options: NewInjectedContextOptions): Promise<InjectedContext> {
  const generator = new FingerprintGenerator();
  const fingerprintWithHeaders = options?.fingerprint ?? generator.getFingerprint(options?.fingerprintOptions ?? {});

  const { fingerprint, headers } = fingerprintWithHeaders;

  const context = await browser.newContext(
    merge(options?.browserContextOptions, {
      userAgent: fingerprint.navigator.userAgent,
      colorScheme: "dark",
      reducedMotion: "reduce",
      viewport: { width: fingerprint.screen.width, height: fingerprint.screen.height },
      extraHTTPHeaders: { "accept-language": headers["accept-language"] },
    }),
  );

  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(context, fingerprintWithHeaders);

  const newPage = makeNewPageFunction(context, fingerprintWithHeaders, options.browserContextOptions?.geolocation);

  return create(context, { fingerprint: fingerprintWithHeaders, geolocation: options?.browserContextOptions?.geolocation, newPage });
}

export async function newInjectedPersistentContext(driver: (typeof browsers)[SuperbeesBrowserType], options: NewInjectedPersistentContextOptions): Promise<InjectedContext> {
  const generator = new FingerprintGenerator();
  const fingerprintWithHeaders = options?.fingerprint ?? generator.getFingerprint(options?.fingerprintOptions ?? {});

  const { fingerprint, headers } = fingerprintWithHeaders;

  const context = await driver.launchPersistentContext(
    "",
    merge(options?.browserContextOptions, {
      userAgent: fingerprint.navigator.userAgent,
      colorScheme: "dark",
      reducedMotion: "reduce",
      viewport: { width: fingerprint.screen.width, height: fingerprint.screen.height },
      extraHTTPHeaders: { "accept-language": headers["accept-language"] },
    }),
  );

  if (options.browserContextOptions?.storageState?.cookies.length) {
    await context.addCookies(options.browserContextOptions.storageState.cookies);
  }

  const injector = new FingerprintInjector();
  await injector.attachFingerprintToPlaywright(context, fingerprintWithHeaders);

  const newPage = makeNewPageFunction(context, fingerprintWithHeaders, options.browserContextOptions?.geolocation);

  return create(context, { fingerprint: fingerprintWithHeaders, geolocation: options?.browserContextOptions?.geolocation, newPage });
}

function makeNewPageFunction(context: BrowserContext, fingerprint?: fg.BrowserFingerprintWithHeaders, geolocation?: pw.Geolocation) {
  return async (): Promise<InjectedPage> => {
    const page = await context.newPage();
    return create(page, { fingerprint, geolocation, storageState: context.storageState });
  };
}

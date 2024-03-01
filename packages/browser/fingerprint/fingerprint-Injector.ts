// @ts-nocheck
import { readFileSync } from "fs";

import { BrowserFingerprintWithHeaders, Fingerprint } from "fingerprint-generator";
import { BrowserContext } from "playwright";

export interface EnhancedFingerprint extends Fingerprint {
  userAgent: string;
  historyLength: number;
}

declare function overrideInstancePrototype<T>(instance: T, overrideObj: Partial<T>): void;
declare function overrideUserAgentData(userAgentData: Record<string, string>): void;
declare function overrideDocumentDimensionsProps(props: Record<string, number>): void;
declare function overrideWindowDimensionsProps(props: Record<string, number>): void;
declare function overrideBattery(batteryInfo?: Record<string, string | number>): void;
declare function overrideCodecs(audioCodecs: Record<string, string>, videoCodecs: Record<string, string>): void;
declare function overrideWebGl(webGlInfo: Record<string, string>): void;
declare function overrideIntlAPI(language: string): void;
declare function overrideStatic(): void;
declare function runHeadlessFixes(): void;
declare function blockWebRTC(): void;

/**
 * Fingerprint injector class.
 * @class
 */
class FingerprintInjector {
  private utilsJs = this._loadUtils();

  private onlyInjectableHeaders(headers: Record<string, string>, browserName?: string): Record<string, string> {
    const requestHeaders = [
      "accept-encoding",
      "accept",
      "cache-control",
      "pragma",
      "sec-fetch-dest",
      "sec-fetch-mode",
      "sec-fetch-site",
      "sec-fetch-user",
      "upgrade-insecure-requests",
    ];

    const filteredHeaders = { ...headers };

    requestHeaders.forEach((header) => {
      delete filteredHeaders[header];
    });

    // Chromium-based controlled browsers do not support `te` header.
    // Probably needs more investigation, but for now, we can just remove it.
    if (!(browserName?.toLowerCase().includes("firefox") ?? false)) {
      delete filteredHeaders.te;
    }

    return filteredHeaders;
  }

  async attachFingerprintToPlaywright(browserContext: BrowserContext, browserFingerprintWithHeaders: BrowserFingerprintWithHeaders): Promise<void> {
    const { fingerprint, headers } = browserFingerprintWithHeaders;
    const enhancedFingerprint = this._enhanceFingerprint(fingerprint);

    const content = this.getInjectableFingerprintFunction(enhancedFingerprint);

    const browserName = browserContext.browser()?.browserType().name();
    await browserContext.setExtraHTTPHeaders(this.onlyInjectableHeaders(headers, browserName));

    browserContext.on("page", (page) => {
      page.emulateMedia({ colorScheme: "dark" }).catch(() => {});
    });

    await browserContext.addInitScript({
      content,
    });
  }

  private getInjectableFingerprintFunction(fingerprint: EnhancedFingerprint): string {
    function inject() {
      const {
        battery,
        navigator: { extraProperties, userAgentData, webdriver, ...navigatorProps },
        screen: allScreenProps,
        videoCard,
        historyLength,
        audioCodecs,
        videoCodecs,
        mockWebRTC,
        slim,
        // @ts-expect-error internal browser code
      } = fp as EnhancedFingerprint;

      const {
        // window screen props
        outerHeight,
        outerWidth,
        devicePixelRatio,
        innerWidth,
        innerHeight,
        screenX,
        pageXOffset,
        pageYOffset,

        // Document screen props
        clientWidth,
        clientHeight,
        // Ignore hdr for now.

        hasHDR,
        // window.screen props
        ...newScreen
      } = allScreenProps;

      const windowScreenProps = {
        innerHeight,
        outerHeight,
        outerWidth,
        innerWidth,
        screenX,
        pageXOffset,
        pageYOffset,
        devicePixelRatio,
      };
      const documentScreenProps = {
        clientHeight,
        clientWidth,
      };

      runHeadlessFixes();

      if (mockWebRTC) blockWebRTC();

      if (slim) {
        // @ts-expect-error internal browser code
        // eslint-disable-next-line dot-notation
        window["slim"] = true;
      }

      overrideIntlAPI(navigatorProps.language);
      overrideStatic();

      if (userAgentData) {
        overrideUserAgentData(userAgentData);
      }

      if (window.navigator.webdriver) {
        (navigatorProps as any).webdriver = false;
      }
      overrideInstancePrototype(window.navigator, navigatorProps);

      overrideInstancePrototype(window.screen, newScreen);
      overrideWindowDimensionsProps(windowScreenProps);
      overrideDocumentDimensionsProps(documentScreenProps);

      overrideInstancePrototype(window.history, { length: historyLength });

      overrideWebGl(videoCard);
      overrideCodecs(audioCodecs, videoCodecs);

      overrideBattery(battery);
    }

    const mainFunctionString: string = inject.toString();

    return `(()=>{${this.utilsJs}; const fp=${JSON.stringify(fingerprint)}; (${mainFunctionString})()})()`;
  }

  private _enhanceFingerprint(fingerprint: Fingerprint): EnhancedFingerprint {
    const { navigator, ...rest } = fingerprint;

    return {
      ...rest,
      navigator,
      userAgent: navigator.userAgent,
      historyLength: this._randomInRange(2, 6),
    };
  }

  private _loadUtils(): string {
    // path.join would be better here, but Vercel's build system doesn't like it (https://github.com/apify/fingerprint-suite/issues/135)
    const utilsJs = readFileSync(`${__dirname}/utils.js`);
    return `\n${utilsJs}\n`;
  }

  private _randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }
}

export default FingerprintInjector;

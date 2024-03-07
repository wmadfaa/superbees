import type * as pw from "playwright";
import type * as fp from "../fingerprint";

import fs from "fs";
import path from "path";
import { isEqual } from "lodash";

import * as resources from "@superbees/resources";

import MetadataDB from "./metadata-db";

type PWRouteURL = Parameters<fp.InjectedContext["route"]>[0];
class BrowserCache {
  constructor(readonly context: fp.InjectedContext) {}

  handleRequest = async (route: pw.Route, request: pw.Request) => {
    const cacheable = await this.isCacheable(request);
    if (!cacheable) return route.continue();
    const { dirPath, filePath } = cacheable;

    if (!cacheable.fileExists) {
      try {
        await this.handleResponse(await route.fetch(), cacheable);
      } catch {
        return route.continue();
      }
    }

    const db = MetadataDB.init_or_get(path.join(dirPath, "superbees_cache_metadata.db"));
    const metadata = db.get_metadata(filePath);
    if (!metadata) return route.continue();

    return route.fulfill({
      status: 200,
      contentType: metadata.mimeType,
      headers: JSON.parse(metadata.headers || "{}"),
      body: await fs.promises.readFile(filePath),
    });
  };

  handleResponse = async (response: pw.APIResponse, cacheable: Awaited<ReturnType<typeof this.isCacheable>>) => {
    const mimeType = response.headers()["content-type"];
    if (!cacheable || cacheable.fileExists || !response.ok() || !mimeType) throw `unCacheable`;
    const { dirPath, filePath } = cacheable;
    const body = await response.body();
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, body);
    const db = MetadataDB.init_or_get(path.join(dirPath, "superbees_cache_metadata.db"));
    db.upset_metadata({ url: filePath, mimeType, headers: JSON.stringify(response.headers()) });
  };

  async attachCacheHandlers(url_filter: PWRouteURL, context: fp.InjectedContext = this.context) {
    await context.route(url_filter, this.handleRequest);
    return () => this.detachCacheHandlers(url_filter, context);
  }

  async detachCacheHandlers(url_filter: PWRouteURL, context: fp.InjectedContext = this.context) {
    await context.unroute(url_filter, this.handleRequest);
  }

  async isCacheable(request: pw.Request) {
    if (request.method() !== "GET" || !isEqual(await request.allHeaders(), request.headers())) return false;
    const urlObj = new URL(this.resolvePathForIndexHtml(request.url()));
    const dirPath = path.join(resources.CACHE_PATH, urlObj.hostname);
    const filePath = path.join(dirPath, urlObj.pathname);
    if (!/\.\w+$/.test(filePath)) return null;

    const fileExists = await fs.promises.access(filePath, fs.constants.F_OK).then(
      () => true,
      () => false,
    );

    return { urlObj, dirPath, filePath, fileExists };
  }

  private resolvePathForIndexHtml(requestUrl: string) {
    const url = new URL(requestUrl);
    let path = url.pathname;
    if (!(path.endsWith("/") || path === "")) return requestUrl;
    path += "index.html";
    return url.origin + path;
  }
}

export default BrowserCache;

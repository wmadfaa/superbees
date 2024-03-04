import * as path from "path";
import * as fs from "fs";

import * as pw from "playwright";
import { isEqual } from "lodash";

import * as resources from "@superbees/resources";

import MetadataDB from "./metadata-db";

function resolvePathForIndexHtml(requestUrl: string) {
  const url = new URL(requestUrl);
  let path = url.pathname;
  if (!(path.endsWith("/") || path === "")) return requestUrl;
  path += "index.html";
  return url.origin + path;
}

async function cacheHandler(route: pw.Route, request: pw.Request) {
  if (request.method() !== "GET") return route.continue();
  const urlObj = new URL(resolvePathForIndexHtml(request.url()));
  const dirPath = path.join(resources.CACHE_PATH, urlObj.hostname);
  const filePath = path.join(dirPath, urlObj.pathname);
  if (!/\.\w+$/.test(filePath)) return route.continue();

  const fileExists = await fs.promises.access(filePath, fs.constants.F_OK).then(
    () => true,
    () => false,
  );

  if (fileExists) {
    const db = MetadataDB.init_or_get(path.join(dirPath, "superbees_cache_metadata.db"));

    const metadata = db.get_metadata(filePath);
    return route.fulfill({
      status: 200,
      contentType: metadata.mimeType,
      headers: JSON.parse(metadata.headers || "{}"),
      body: await fs.promises.readFile(filePath),
    });
  } else {
    try {
      const response = await route.fetch();
      const request_has_security_headers = !isEqual(await request.allHeaders(), request.headers());
      const mimeType = response.headers()["content-type"];
      if (!response.ok() || request_has_security_headers || !mimeType) return route.continue();

      const headers = JSON.stringify(response.headers());
      const body = await response.body();

      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, body);

      const db = MetadataDB.init_or_get(path.join(dirPath, "superbees_cache_metadata.db"));
      db.upset_metadata({ url: filePath, mimeType, headers });

      return route.fulfill({ response, body });
    } catch (e) {
      if ((e as Error).message.startsWith(`route.fetch:`)) {
        return route.continue();
      } else {
        throw e;
      }
    }
  }
}

export default cacheHandler;

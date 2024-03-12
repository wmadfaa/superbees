import * as fs from "fs";
import * as path from "path";

import { faker } from "@faker-js/faker";

import { STORAGE_PATH } from "@superbees/resources";

export async function consumeOnePfp() {
  const storage_file = path.join(STORAGE_PATH, "opensea-eth-pfps.txt");
  const urls = await fs.promises.readFile(storage_file, "utf-8").then((s) => s.trim().split("\n"));
  const url = urls.splice(faker.number.int({ max: urls.length }), 1)[0];
  await fs.promises.writeFile(storage_file, urls.join("\n"));

  const extension = url.match(/^http.*\.(\w+)$/)![1];

  return {
    name: `${faker.system.fileName({ extensionCount: 0 })}.${extension}`,
    mimeType: `image/${extension}`,
    buffer: Buffer.from(await fetch(url).then((v) => v.arrayBuffer())),
  };
}

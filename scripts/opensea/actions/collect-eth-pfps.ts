import * as fs from "fs";
import * as path from "path";

import { uniq, shuffle } from "lodash";

import * as script from "@superbees/script";

async function collectEthPfps(opts: script.SuperbeesScriptFunctionOptions<any>) {
  const context = await opts.browser.newPersistentContext("", {
    driverType: "chromium",
  });

  const page = await context.newPage();
  const $ = new script.SuperbeesScript(page);

  try {
    await page.goto(`https://opensea.io/rankings/trending?sortBy=one_day_volume&chain=ethereum&category=pfps`);
    await $.waitUntilStable();

    const collection_list_items_path = `//div[@role="table"]//a[@data-id="Item"]`;
    await $.waitFor(`(${collection_list_items_path})[1]`);
    const collections_count = await $.locator(collection_list_items_path).count();

    let collections_set = new Set<string>();
    for (let i = 1; i <= Math.min(100, collections_count); i++) {
      await $.waitAndClick(`(${collection_list_items_path})[${i}]`);
      await $.waitUntilStable();

      const nft_list_items_path = `//article//img`;
      await $.waitFor(`(${nft_list_items_path})[1]`);
      let nfts_count = await $.locator(nft_list_items_path).count();

      for (let j = 1; j <= 10; j++) {
        await $.unThrow($.locator(`(${nft_list_items_path})[${nfts_count}]`).scrollIntoViewIfNeeded());
        nfts_count = await $.locator(nft_list_items_path).count();
        await $.waitUntilStable();
      }

      let nfts_set = new Set<string>();
      for (let j = 1; j <= Math.min(300, nfts_count); j++) {
        const srcset = await $.waitAndGetAttribute(`(${nft_list_items_path})[${j}]`, "srcset");
        if (!srcset) continue;
        let src = srcset.split(" ").shift()!;
        src = src.replace(new URL(src).search, "");
        if (!/.*\.(png|jpg)/.test(src)) continue;
        if (nfts_set.has(src)) {
          nfts_set.clear();
          break;
        }
        nfts_set.add(src);
      }
      if (nfts_set.size) {
        nfts_set.forEach((v) => collections_set.add(v));
      }
      await page.goBack();
      await $.waitUntilStable();
    }
    const storage_file_path = path.join(script.utils.resources.STORAGE_PATH, `opensea-eth-pfps.txt`);
    await fs.promises.appendFile(storage_file_path, Array.from(collections_set).join("\n"));
    const full_set = await fs.promises.readFile(storage_file_path, "utf-8");
    await fs.promises.writeFile(storage_file_path, shuffle(uniq(full_set.trim().split("\n"))).join("\n"));
  } finally {
    await context.close();
  }
}

export default collectEthPfps;

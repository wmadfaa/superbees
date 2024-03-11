import * as script from "@superbees/script";
import Twitter from "./src/twitter";

async function main(page: script.InjectedPage, opts: script.SuperbeesScriptUtilFunctionOptions<never>) {
  return new Twitter(page, opts);
}

export default main;

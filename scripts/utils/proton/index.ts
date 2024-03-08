import * as script from "@superbees/script";
import Proton from "./src/proton";

async function main(page: script.InjectedPage, opts: script.SuperbeesScriptUtilFunctionOptions<never>) {
  return new Proton(page, opts);
}

export default main;

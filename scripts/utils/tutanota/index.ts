import * as script from "@superbees/script";
import Tutanota from "./src/tutanota";

async function main(page: script.InjectedPage, opts: script.SuperbeesScriptUtilFunctionOptions<never>) {
  return new Tutanota(page, opts);
}

export default main;

import * as script from "@superbees/script";
import Metamask from "./src/metamask";

async function main(page: script.InjectedPage) {
  return new Metamask(page);
}

export default main;

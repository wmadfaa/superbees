import * as script from "@superbees/script";

import collectEthPfps from "./actions/collect-eth-pfps";

interface IOptions {
  action?: "collect-eth-pfps";
}
async function main(opts: script.SuperbeesScriptFunctionOptions<IOptions>) {
  const { action = "collect-eth-pfps" } = opts.vars || {};
  switch (action) {
    case "collect-eth-pfps": {
      return collectEthPfps(opts);
    }
    default: {
      throw `unrecognized action: ${action}`;
    }
  }
}

export default main;

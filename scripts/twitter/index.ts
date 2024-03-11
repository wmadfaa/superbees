import * as script from "@superbees/script";

import signup from "./actions/signup";
import updateStatus from "./actions/update-status";

interface Vars {
  action?: "signup" | "update-status";
  accountId: string;
}
async function main(opts: script.SuperbeesScriptFunctionOptions<Vars>) {
  const { action = "signup" } = opts.vars || {};
  switch (action) {
    case "signup": {
      return signup(opts);
    }
    case "update-status": {
      return updateStatus(opts);
    }
    default: {
      throw `unrecognized action: ${action}`;
    }
  }
}

export default main;

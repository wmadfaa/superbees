import * as script from "@superbees/script";

import signup from "./actions/signup";

interface IOptions {
  action?: "signup" | "update-status";
}
async function main(opts: script.SuperbeesScriptFunctionOptions<IOptions>) {
  const { action = "signup" } = opts.vars || {};
  switch (action) {
    case "signup": {
      return signup(opts);
    }
    default: {
      throw `unrecognized Tutanota action: ${action}`;
    }
  }
}

export default main;

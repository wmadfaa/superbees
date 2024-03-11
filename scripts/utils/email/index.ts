import { EmailPlatform } from "@prisma/client";

import * as script from "@superbees/script";

import Tutanota from "../tutanota/src/tutanota";
import Proton from "../proton/src/proton";

interface Vars {
  platform: EmailPlatform;
}

async function main(page: script.InjectedPage, opts: script.SuperbeesScriptUtilFunctionOptions<Vars>) {
  if (!opts.vars?.platform) throw `opts.vars.platform is required`;

  switch (opts.vars.platform) {
    case EmailPlatform.TUTANOTA: {
      return new Tutanota(page, opts);
    }
    case EmailPlatform.PROTONMAIL: {
      return new Proton(page, opts);
    }
    default: {
      throw `unknown email platform ${opts.vars.platform}`;
    }
  }
}

export default main;

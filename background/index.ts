import SuperbeesBrowser from "@superbees/browser";
import SuperbeesUncaptcha from "@superbees/uncaptcha";
import SuperbeesProxy from "@superbees/proxy";

import * as actions from "./src/actions";

import credentials from "../.credentials.json";

(async () => {
  const browser = new SuperbeesBrowser();
  const uncaptcha = new SuperbeesUncaptcha(credentials["captcha-solvers"]);
  const proxy = new SuperbeesProxy(credentials["proxy-services"]);

  actions.handleOnScriptRun({ browser, uncaptcha, proxy });

  process.send?.(`ready`);
})();

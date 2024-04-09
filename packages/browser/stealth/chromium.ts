import { chromium } from "playwright-extra";

import pluginStealth from "puppeteer-extra-plugin-stealth";
const stealth = pluginStealth();

// stealth.enabledEvasions.delete("chrome.app");
// stealth.enabledEvasions.delete("chrome.csi");
// stealth.enabledEvasions.delete("chrome.loadTimes");
// stealth.enabledEvasions.delete("chrome.runtime");
// stealth.enabledEvasions.delete("defaultArgs");
// stealth.enabledEvasions.delete("iframe.contentWindow");
// stealth.enabledEvasions.delete("media.codecs");
stealth.enabledEvasions.delete("navigator.hardwareConcurrency");
// stealth.enabledEvasions.delete("navigator.languages");
// stealth.enabledEvasions.delete("navigator.permissions");
// stealth.enabledEvasions.delete("navigator.plugins");
// stealth.enabledEvasions.delete("navigator.webdriver");
// stealth.enabledEvasions.delete("sourceurl");
// stealth.enabledEvasions.delete("user-agent-override");
// stealth.enabledEvasions.delete("webgl.vendor");
// stealth.enabledEvasions.delete("window.outerdimensions");
chromium.use(stealth);

export default chromium;

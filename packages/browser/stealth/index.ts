import chromium from "./chromium";
import firefox from "./firefox";

const browsers = { chromium, firefox };

export type SuperbeesBrowserType = keyof typeof browsers;
export type SuperbeesBrowserDriver = (typeof browsers)[keyof typeof browsers];
export default browsers;

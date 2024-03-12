import * as util from "util";

export * as extensions from "./browser-extensions";
export * as resources from "@superbees/resources";
export * as profile from "./create-profile";
export * as wallet from "./create-wallet";
export * as opensea from "./opensea";

export function even(num: number, direction: "dec" | "inc" = "dec") {
  if (direction.toLowerCase() === "dec") {
    return num % 2 === 0 ? num : num - 1;
  } else if (direction.toLowerCase() === "inc") {
    return num % 2 === 0 ? num : num + 1;
  } else {
    throw new Error("Invalid direction. Valid options are 'dec' or 'inc'.");
  }
}
export const sleep = (ms?: number) => util.promisify(setTimeout)(ms);

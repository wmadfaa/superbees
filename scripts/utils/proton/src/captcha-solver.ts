import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as child_process from "child_process";

import { faker } from "@faker-js/faker";

import * as script from "@superbees/script";

async function captchaSolver(puzel: Buffer, challenges: string[]) {
  const processor_path = path.join(script.utils.resources.STORAGE_PATH, "proton-captcha-processor");

  const img_path = path.join(processor_path, ".tmp", `${faker.string.uuid()}.png`);
  await fs.promises.writeFile(img_path, puzel);

  const image_detector_res = await util.promisify(child_process.exec)(`python3 ${path.join(processor_path, "image-detector/main.py")} ${img_path}`, { encoding: "utf8" });
  await fs.promises.rm(img_path);
  if (image_detector_res.stderr) throw image_detector_res.stderr;
  const puzel_solution = JSON.parse(image_detector_res.stdout);

  const pow_res = await util.promisify(child_process.exec)(`${path.join(processor_path, "pow/target/release/pow")} '${JSON.stringify(challenges)}'`, { encoding: "utf8" });
  if (pow_res.stderr) throw pow_res.stderr;
  const challenges_solution = JSON.parse(pow_res.stdout);

  return {
    x: puzel_solution[0],
    y: puzel_solution[1],
    answers: challenges_solution,
    clientData: null,
    pieceLoadElapsedMs: faker.number.float({ min: 140, max: 190 }),
    bgLoadElapsedMs: faker.number.float({ min: 180, max: 220 }),
    challengeLoadElapsedMs: faker.number.float({ min: 180, max: 222 }),
    solveChallengeMs: faker.number.float({ min: 5000, max: 5500 }),
    powElapsedMs: faker.number.float({ min: 540, max: 600 }),
  };
}

export default captchaSolver;

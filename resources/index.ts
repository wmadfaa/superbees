import * as fs from "fs";
import * as path from "path";

import AdmZip from "adm-zip";

export const STORAGE_PATH = path.join(__dirname, "./storage");

export async function getUnpackedExtensionPath(extensionName: string) {
  const dirPath = path.join(STORAGE_PATH, "extensions", extensionName);
  const zipPath = path.join(STORAGE_PATH, "extensions", `${extensionName}.zip`);

  if (!fs.existsSync(dirPath)) {
    if (!fs.existsSync(zipPath)) throw new Error(`Extension ${extensionName} not found`);

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(dirPath, true);
  }

  return dirPath;
}

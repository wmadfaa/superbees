import * as fs from "fs";
import * as path from "path";

import AdmZip from "adm-zip";

export const STORAGE_PATH = path.join(__dirname, "./storage");
export const EXTENSIONS_PATH = path.join(STORAGE_PATH, "./extensions");
export const CACHE_PATH = path.join(STORAGE_PATH, "./cache");

export async function getUnpackedExtensionPath(extensionName: string) {
  const dirPath = path.join(EXTENSIONS_PATH, extensionName);
  const zipPath = path.join(EXTENSIONS_PATH, `${extensionName}.zip`);

  if (!fs.existsSync(dirPath)) {
    if (!fs.existsSync(zipPath)) throw new Error(`Extension ${extensionName} not found`);

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(dirPath, true);
  }

  return dirPath;
}

import * as fs from "fs";
import * as path from "path";

import dotenv from "dotenv";

export default dotenv.parse(fs.readFileSync(path.join(__dirname, "../../.env"), { encoding: "utf-8" }));

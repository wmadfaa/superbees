import * as util from "util";

import pm2 from "pm2";

export async function connect() {
  return util.promisify(pm2.connect).bind(pm2)();
}

export async function disconnect() {
  return util.promisify(pm2.disconnect).bind(pm2)();
}

export async function list() {
  return util.promisify<pm2.ProcessDescription[]>(pm2.list).bind(pm2)();
}

export async function start(options: pm2.StartOptions) {
  return util.promisify<pm2.StartOptions>(pm2.start).bind(pm2)(options);
}

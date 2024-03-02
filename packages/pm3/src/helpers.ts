import pm2 from "pm2";
import { list } from "./pm2";

export async function find_process(predicate: (value: pm2.ProcessDescription) => boolean) {
  const discs = await list();
  return discs.find(predicate);
}

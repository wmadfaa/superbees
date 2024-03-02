import * as util from "util";

(async () => {
  await util.promisify(setTimeout)(3000);
  process.send!(`ready`);
})();

import * as pm3 from "@superbees/pm3";

(async () => {
  pm3.registerAction("cli:command", async (data, process) => {
    let i = 0;
    const interval = setInterval(() => {
      if (i > 10) {
        clearInterval(interval);
        process.complete();
      } else {
        process.send(`Hi ${i}`);
        i += 1;
      }
    }, 1000);
  });

  process.send?.(`ready`);
})();

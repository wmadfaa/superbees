import * as script from "@superbees/script";

import Twitter from "../../utils/twitter/src/twitter";
import { values } from "lodash";

interface Vars {
  accountId: string;
}

async function updateStatus(opts: script.SuperbeesScriptFunctionOptions<Vars>) {
  const entity = await opts.prisma.entity.findFirstOrThrow({ where: { id: opts.entityId } });
  const account = await opts.prisma.account.findUniqueOrThrow({ where: { id: opts.vars?.accountId, entityId: entity.id } });

  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext(entity.id, {
    driverType: "chromium",
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers((url) => values(script.constants.CACHEABLE_REGEX).some((r) => r.test(url.toString())));

  const page = await context.newPage();
  const $: Twitter = await opts.util("twitter", [page, opts]);

  try {
    opts.logger.info(`verify email status`);
    // const status = await $.login(account);
    // await opts.prisma.account.update({ where: { id: account.id }, data: { status } } as any);
    // opts.logger.info(`updated account status: [ ${account.status} → ${status} ]`);
  } finally {
    await context.close(entity.id);
    await opts.proxy.releaseProxy("dataimpulse", proxy);
  }
}

export default updateStatus;

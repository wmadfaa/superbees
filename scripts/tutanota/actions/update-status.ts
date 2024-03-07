import * as script from "@superbees/script";

import Tutanota from "../../utils/tutanota/src/tutanota";

async function updateStatus(opts: script.SuperbeesScriptFunctionOptions<unknown>) {
  if (!opts.entityId) throw `missing options.entityId`;

  const entity = await opts.prisma.entity.findFirstOrThrow({ where: { id: opts.entityId ?? "" }, include: { email: true } });

  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext(entity.id, {
    driverType: "chromium",
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers(/^http(s?):\/\/app\.tuta\.com\/(?!rest).*/);
  const page = await context.newPage();
  const $: Tutanota = await opts.util("tutanota", [page, opts]);

  try {
    await $.go_to_root_if_needed();

    opts.logger.info(`verify email status`);
    const status = await $.login(entity.email);
    await opts.prisma.email.update({ where: { id: entity.emailId }, data: { status } } as any);
    opts.logger.info(`updated email status: [ ${entity.email.status} → ${status} ]`);
  } finally {
    await context.close(entity.id);
    await opts.proxy.releaseProxy("dataimpulse", proxy);
  }
}

export default updateStatus;

import * as script from "@superbees/script";

import Proton from "../../utils/proton/src/proton";

async function updateStatus(opts: script.SuperbeesScriptFunctionOptions<unknown>) {
  const entity = await opts.prisma.entity.findFirstOrThrow({ where: { id: opts.entityId ?? "" }, include: { email: true } });

  const proxy = await opts.proxy.requestProxy("dataimpulse", { sticky: true });
  const context = await opts.browser.newContext(entity.id, {
    driverType: "chromium",
    browserContextOptions: { proxy: { server: proxy.server } },
  });
  await context.cache.attachCacheHandlers((url) =>
    [script.constants.CACHEABLE_REGEX.PROTON_ACCOUNT_CACHEABLE_REGEX, script.constants.CACHEABLE_REGEX.PROTON_MAIL_CACHEABLE_REGEX].some((r) => r.test(url.toString())),
  );

  const page = await context.newPage();
  const $: Proton = await opts.util("proton", [page, opts]);

  try {
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

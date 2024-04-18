import * as script from "@superbees/script";
import { merge } from "lodash";
import { EmailClass } from "../utils/email";
import Twitter from "../utils/twitter/src/twitter";
import Metamask from "../utils/metamask/src/metamask";

interface IOptions {
  entityId: string;
  email?: boolean;
  twitter?: boolean;
  metamask?: boolean;
}
async function main(opts: script.SuperbeesScriptFunctionOptions<IOptions>) {
  const { entityId, email, twitter, metamask } = opts.vars!;

  const entity = await opts.prisma.entity.findUniqueOrThrow({ where: { id: entityId } });

  const args = new Array<string>();

  if (metamask) {
    const extensionPath = await script.utils.resources.getUnpackedExtensionPath("metamask-chrome-11.13.1");
    args.push(`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`);
  }

  const context = await opts.browser.newPersistentContext(entity.id, {
    driverType: "chromium",
    browserContextOptions: { headless: false, args },
  });

  if (metamask) {
    const wallet_data = await opts.prisma.wallet.findUniqueOrThrow({ where: { type: "EVM", entityId: opts.entityId } });
    const metamask_page = await Metamask.get_metamask_home_page(context);
    const $m: Metamask = await opts.util("metamask", [metamask_page, opts]);
    await $m.import_wallet(wallet_data.mnemonic, wallet_data.password);
  }

  if (email) {
    const email_data = await opts.prisma.email.findFirstOrThrow({ where: { entity: { id: entity.id } } });
    const email_page = await context.newPage();
    const $e: EmailClass = await opts.util("email", [email_page, merge(opts, { vars: { platform: email_data.platform } })]);
    await $e.login(email_data);
  }

  if (twitter) {
    const tw_data = await opts.prisma.account.findFirstOrThrow({ where: { entityId: opts.entityId, platform: "TWITTER" } });
    const tw_page = await context.newPage();
    const $a: Twitter = await opts.util("twitter", [tw_page, opts]);
    await $a.login(tw_data);
  }
}

export default main;

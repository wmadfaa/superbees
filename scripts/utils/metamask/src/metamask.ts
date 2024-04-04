import * as async from "async";
import * as script from "@superbees/script";
import type * as pw from "playwright";
import { PWwaitForOptions } from "@superbees/script";
import { Page } from "playwright";

export enum SettingsSidebarMenus {
  General = 1,
  Advanced = 2,
}

export interface Network {
  name: string;
  rpcUrl: string;
  chainId: string;
  symbol: string;
  blockExplorerUrl?: string;
}

export type GasConfigType = "low" | "market" | "aggressive" | "site";
export interface GasCustomSetting {
  maxBaseFee: number;
  priorityFee: number;
  gasLimit?: number;
}

export type GasSetting = GasConfigType | GasCustomSetting;

class Metamask extends script.SuperbeesScript {
  constructor(protected readonly page: script.InjectedPage) {
    super(page);
  }

  static async get_metamask_home_page(context: script.SuperbeesContext): Promise<script.InjectedPage> {
    const extensions = await script.utils.extensions.getChromeExtensionsData(context);
    const extensionId = extensions["metamask"]?.id;
    if (!extensionId) throw `couldn't find Metamask extension in "chrome-extensions" page`;

    let page = context.pages().find((page) => page.url().includes(`chrome-extension://${extensionId}`));
    if (!page) page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/home.html`, { waitUntil: "load" });

    // @ts-expect-error
    return page;
  }

  async import_wallet(phrase: string, password: string) {
    const phrase_words = phrase.split(" ");

    await this.waitAndClick(`[data-testid="onboarding-terms-checkbox"]`);
    await this.waitAndClick(`[data-testid="onboarding-import-wallet"]`);

    await this.waitAndClick(`[data-testid="metametrics-no-thanks"]`);

    await this.waitAndSelectOption(`.import-srp__number-of-words-dropdown > .dropdown__select`, `${phrase_words.length}`);
    for (const [index, word] of phrase_words.entries()) {
      await this.waitAndFill(`[data-testid="import-srp__srp-word-${index}"]`, word);
    }
    await this.waitAndClick(`[data-testid="import-srp-confirm"]`);

    await this.waitAndFill(`[data-testid="create-password-new"]`, password);
    await this.waitAndFill(`[data-testid="create-password-confirm"]`, password);
    await this.waitAndClick(`[data-testid="create-password-terms"]`);
    await this.waitAndClick(`[data-testid="create-password-import"]`);

    await this.waitAndClick(`[data-testid="onboarding-complete-done"]`);
    await this.waitAndClick(`[data-testid="pin-extension-next"]`);
    await this.waitAndClick(`[data-testid="pin-extension-done"]`);
  }

  async lock() {
    await this.waitAndClick(`[data-testid="account-options-menu-button"]`);
    await this.waitAndClick(`[data-testid="global-menu-lock"]`);
  }

  async unlock(password: string) {
    await this.waitAndFill(`[data-testid="unlock-password"]`, password);
    await this.waitAndClick(`[data-testid="unlock-submit"]`);

    await this.unThrow(this.waitFor(`.spinner`, { state: "hidden" }));
  }

  async add_new_account(name: string) {
    await this.waitAndClick(`[data-testid="account-menu-icon"]`);

    await this.waitAndClick(`[data-testid="multichain-account-menu-popover-action-button"]`);
    await this.waitAndClick(`[data-testid="multichain-account-menu-popover-add-account"]`);

    await this.waitAndFill(`.multichain-account-menu-popover input`, name);

    await this.waitAndClick(`.multichain-account-menu-popover button.mm-button-primary`);
  }

  async get_account_address() {
    await this.waitAndClick(`[data-testid="account-options-menu-button"]`);
    await this.waitAndClick(`[data-testid="account-list-menu-details"]`);

    const account = await this.waitAndGetTextContent(`[data-testid="address-copy-button-text"]`);

    await this.waitAndClick(`.mm-modal-content .mm-modal-header button.mm-button-icon.mm-button-icon--size-sm`);

    return account;
  }

  async import_wallet_from_private_key(privateKey: string) {
    await this.waitAndClick(`[data-testid="account-menu-icon"]`);

    await this.waitAndClick(`[data-testid="multichain-account-menu-popover-action-button"]`);
    await this.waitAndClick(`.multichain-account-menu-popover div.mm-box.mm-box--padding-4:nth-child(2) > div.mm-box:nth-child(2) > button`);

    await this.waitAndFill(`input#private-key-box`, privateKey);

    await this.waitAndClick(`[data-testid="import-account-confirm-button"]`);
  }

  async switch_account(name: string) {
    await this.waitAndClick(`[data-testid="account-menu-icon"]`);

    for (const accountNamesLocator of await this.locator(`.multichain-account-list-item__account-name__button`).all()) {
      if ((await accountNamesLocator.textContent())?.toLowerCase() !== name.toLowerCase()) continue;
      await accountNamesLocator.click();
    }
  }

  async open_settings() {
    await this.waitAndClick(`[data-testid="account-options-menu-button"]`);
    await this.waitAndClick(`[data-testid="global-menu-settings"]`);
  }

  async open_sidebar_menu(menu: SettingsSidebarMenus) {
    await this.waitAndClick(`.settings-page__content__tabs .tab-bar__tab.pointer:nth-of-type(${menu})`);
  }

  async resetAccount() {
    await this.waitAndClick(`[data-testid="advanced-setting-reset-account"] button`);
    await this.waitAndClick(".modal .modal-container__footer button.btn-danger-primary");
  }

  async toggle_dismiss_secret_recovery_phrase_reminder() {
    await this.toggle_option(`.settings-page__content-row:nth-of-type(11) .toggle-button`);
  }

  async toggle_show_test_networks() {
    await this.waitAndClick(`[data-testid="network-display"]`);
    await this.toggle_option(`.multichain-network-list-menu-content-wrapper > section > div > label.toggle-button`);
  }

  async switch_network(networkName: string, isTestnet: boolean) {
    await this.waitAndClick(`[data-testid="network-display"]`);

    if (isTestnet) {
      const toggleButtonLocator = this.locator(`.multichain-network-list-menu-content-wrapper > section > div > label.toggle-button`);
      const classes = await this.waitAndGetAttribute(toggleButtonLocator, "class");

      if (classes?.includes("toggle-button--off")) {
        await this.waitAndClick(toggleButtonLocator);
        await this.locator(`.multichain-network-list-menu-content-wrapper label.toggle-button.toggle-button--on`).isChecked();
      }
    }

    for (const net of await this.locator(`.multichain-network-list-menu-content-wrapper .multichain-network-list-item p`).all()) {
      if ((await net.textContent())?.toLowerCase() !== networkName.toLowerCase()) continue;
      else {
        await net.click();
        break;
      }
    }
  }

  async add_network(network: Network) {
    await this.waitAndClick(`[data-testid="network-display"]`);
    await this.waitAndClick(`.multichain-network-list-menu-content-wrapper div.mm-box.mm-box--padding-4 > button`);

    await this.waitAndClick(`[data-testid="add-network-manually"]`);

    await this.waitAndFill(`.networks-tab__add-network-form .form-field:nth-child(1) input`, network.name);
    await this.waitAndFill(`.networks-tab__add-network-form .form-field:nth-child(2) input`, network.rpcUrl);
    await this.waitAndFill(`.networks-tab__add-network-form .form-field:nth-child(3) input`, network.chainId);
    await this.waitAndFill(`[data-testid="network-form-ticker"] input`, network.symbol);
    if (network.blockExplorerUrl) await this.waitAndFill(`.networks-tab__add-network-form .form-field:last-child input`, network.blockExplorerUrl);

    await this.waitAndClick(`.networks-tab__add-network-form .networks-tab__add-network-form-footer button.btn-primary`);
  }

  async open_transaction_details(txIndex: number) {
    await this.waitAndClick(`[data-testid="home__activity-tab"]`);
    await this.waitAndClick(`.tabs__content .transaction-list__completed-transactions .transaction-list-item:nth-child(${txIndex})`);
  }

  async close_transaction_details() {
    await this.waitAndClick(`.popover-container [data-testid="popover-close"]`);
  }

  async connect_to_app(accounts?: string[]) {
    const page = await this.get_notification_page();

    if (accounts?.length) {
      const last = await this.waitFor(
        `.choose-account-list .choose-account-list__list .choose-account-list__account input.choose-account-list__list-check-box:last-child`,
        undefined,
        page,
      );
      await last.setChecked(false);

      for (const account of await page.locator(`.choose-account-list .choose-account-list__list .choose-account-list__account`).all()) {
        const account_name = (await account.textContent())?.toLowerCase();
        if (accounts.find((a) => a.toLowerCase() === account_name)) {
          await account.locator(`input.choose-account-list__list-check-box`).check();
        }
      }
    }

    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, page);
    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, page);
  }

  async sign_structured_message() {
    const page = await this.get_notification_page();

    const scrollDownButton = this.locator(`[data-testid="signature-request-scroll-button"]`, page);
    const signButton = this.locator(`[data-testid="signature-sign-button"]`, page);

    while (await signButton.isDisabled()) {
      await this.waitAndClick(scrollDownButton, undefined, page);
    }

    await this.waitAndClick(signButton, undefined, page);
  }

  async reject_structured_message() {
    await this.waitAndClick(`[data-testid="page-container-footer-cancel"]`, undefined, await this.get_notification_page());
  }

  async sign_message() {
    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, await this.get_notification_page());
  }

  async reject_message() {
    await this.waitAndClick(`[data-testid="page-container-footer-cancel"]`, undefined, await this.get_notification_page());
  }

  async sign_message_with_risk() {
    await this.sign_message();
    await this.waitAndClick(`[data-testid="signature-warning-sign-button"]`, undefined, await this.get_notification_page());
  }

  async approve_new_network() {
    await this.waitAndClick(`.confirmation-footer__actions button.btn-primary`, undefined, await this.get_notification_page());
  }

  async reject_new_network() {
    await this.waitAndClick(`.confirmation-footer__actions button.btn-secondary`, undefined, await this.get_notification_page());
  }

  async approve_switch_network() {
    await this.waitAndClick(`.confirmation-footer__actions button.btn-primary`, undefined, await this.get_notification_page());
  }

  async reject_switch_network() {
    await this.waitAndClick(`.confirmation-footer__actions button.btn-primary`, undefined, await this.get_notification_page());
  }

  async confirm_transaction(opts: GasSetting) {
    const page = await this.get_notification_page();
    if (opts === "site") return await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, page);

    await this.waitAndClick(`[data-testid="edit-gas-fee-icon"]`, undefined, page);

    const estimationNotAvailableErrorMessage = (gasSetting: string) =>
      `[ConfirmTransaction] Estimated fee is not available for the "${gasSetting}" gas setting. By default, MetaMask would use the "site" gas setting in this case, however, this is not YOUR intention.`;

    const handleLowMediumOrAggressiveGasSetting = async (gasSetting: string, selectors: { button: string; maxFee: string }) => {
      if ((await page.locator(selectors.maxFee).textContent()) === "--") {
        throw new Error(estimationNotAvailableErrorMessage(gasSetting));
      }

      await page.locator(selectors.button).click();
    };

    if (opts === "low") {
      await handleLowMediumOrAggressiveGasSetting(opts, {
        button: `[data-testid="edit-gas-fee-item-low"]`,
        maxFee: `[data-testid="edit-gas-fee-item-low"] .edit-gas-item__fee-estimate`,
      });
    } else if (opts === "market") {
      await handleLowMediumOrAggressiveGasSetting(opts, {
        button: `[data-testid="edit-gas-fee-item-medium"]`,
        maxFee: `[data-testid="edit-gas-fee-item-medium"] .edit-gas-item__fee-estimate`,
      });
    } else if (opts === "aggressive") {
      await handleLowMediumOrAggressiveGasSetting(opts, {
        button: `[data-testid="edit-gas-fee-item-high"]`,
        maxFee: `[data-testid="edit-gas-fee-item-high"] .edit-gas-item__fee-estimate`,
      });
    } else {
      await page.locator(`[data-testid="edit-gas-fee-icon"]`).click();

      await page.locator(`[data-testid="base-fee-input"]`).clear();
      await page.locator(`[data-testid="base-fee-input"]`).fill(opts.maxBaseFee.toString());

      await page.locator(`[data-testid="priority-fee-input"]`).clear();
      await page.locator(`[data-testid="priority-fee-input"]`).fill(opts.priorityFee.toString());

      if (opts.gasLimit) {
        await page.locator(`[data-testid="advanced-gas-fee-edit"]`).click();

        await page.locator(`[data-testid="gas-limit-input"]`).clear();
        await page.locator(`[data-testid="gas-limit-input"]`).fill(opts.gasLimit.toString());

        const [, gasLimitErrorLocator] = await this.unThrow(this.waitFor(`div:has(> [data-testid="gas-limit-input"]) + .form-field__error`, undefined, page));

        if (gasLimitErrorLocator) {
          const errorText = await gasLimitErrorLocator.textContent({ timeout: 1_000 });
          throw new Error(`[ConfirmTransaction] Invalid gas limit: ${errorText}`);
        }
      }

      await this.waitAndClick(`.popover-footer > button.btn-primary`, undefined, page);
    }

    await this.waitFor(`.edit-gas-fee-button .info-tooltip`, { state: "hidden" }, page);
    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, page);
  }

  async confirm_transaction_and_wait_for_mining(opts: GasSetting) {
    await this.waitAndClick(`[data-testid="home__activity-tab"]`);

    const newTxsFound = await async.retry<number | null, any>(100, async (callback) => {
      const [e, r] = await this.unThrow(this.locator(`.transaction-list-item .transaction-status-label--unapproved`).count());
      return callback(e, r);
    });
    if (!newTxsFound) throw `No new pending transactions found`;

    await this.confirm_transaction(opts);

    const allTxsMined = await async.retry<boolean, any>(100, async (callback) => {
      const [e1, unapprovedTxs] = await this.unThrow(this.locator(`.transaction-list-item .transaction-status-label--unapproved`).count());
      const [e2, pendingTxs] = await this.unThrow(this.locator(`.transaction-list-item .transaction-status-label--unapproved`).count());
      const [e3, queuedTxs] = await this.unThrow(this.locator(`.transaction-list-item .transaction-status-label--unapproved`).count());

      return callback(e1 || e2 || e3, unapprovedTxs === 0 && pendingTxs === 0 && queuedTxs === 0);
    });
    if (!allTxsMined) throw `All pending and queued transactions were not mined`;
  }

  async reject_transaction() {
    await this.waitAndClick(`[data-testid="page-container-footer-cancel"]`, undefined, await this.get_notification_page());
  }

  async edit_token_permission(customSpendLimit: "max" | number) {
    const page = await this.get_notification_page();
    if (customSpendLimit === "max") {
      return await this.waitAndClick(`[data-testid="custom-spending-cap-max-button"]`, undefined, page);
    }

    await this.waitAndFill(`[data-testid="custom-spending-cap-input"]`, customSpendLimit.toString(), undefined, page);
  }

  async approve_token_permission(gasSetting: GasSetting) {
    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, await this.get_notification_page());
    await this.confirm_transaction(gasSetting);
  }

  async reject_token_permission() {
    await this.waitAndClick(`[data-testid="page-container-footer-cancel"]`, undefined, await this.get_notification_page());
  }

  async add_new_token() {
    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, await this.get_notification_page());
  }

  async provide_public_encryption_key(notificationPage: Page) {
    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, await this.get_notification_page());
  }

  async decrypt_message(notificationPage: Page) {
    await this.waitAndClick(`[data-testid="page-container-footer-next"]`, undefined, await this.get_notification_page());
  }

  private async toggle_option(locator: pw.Locator | string, options?: PWwaitForOptions, pg = this.page) {
    locator = this.locator(locator, pg);
    await this.waitFor(locator, options, pg);

    let classes = await locator.getAttribute("class");
    if (!classes) throw `locator.getAttribute("class") returned null`;

    const isOn = classes.includes("toggle-button--on");

    await this.waitAndClick(locator, options, pg);

    classes = await locator.getAttribute("class");

    return !!classes?.includes(`toggle-button--${isOn ? "off" : "on"}`);
  }

  private async get_notification_page() {
    const context = this.page.context();
    const extensions = await script.utils.extensions.getChromeExtensionsData(context);
    const extensionId = extensions["metamask"]?.id;
    if (!extensionId) throw `Metamask is not installed on the current context`;

    const notificationPageUrl = `chrome-extension://${extensionId}/notification.html`;

    const isNotificationPage = (page: Page) => page.url().includes(notificationPageUrl);

    let notificationPage = context.pages().find(isNotificationPage);

    if (!notificationPage) notificationPage = await context.waitForEvent("page", { predicate: isNotificationPage });

    await notificationPage.setViewportSize({ width: 360, height: 592 });

    await this.waitUntilStable(undefined, notificationPage as script.InjectedPage);

    return notificationPage as script.InjectedPage;
  }
}

export default Metamask;

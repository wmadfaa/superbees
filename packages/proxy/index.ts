import type { IProxyUser, IProxySettings, IProxy } from "./src/@implementation";

import DataimpulseProxy from "./src/dataimpulse";
import NodemavenProxy from "./src/nodemaven";

export interface IProxyUsers {
  dataimpulse?: IProxyUser;
  nodemaven?: IProxyUser;
}

export type ProxyType = "dataimpulse" | "nodemaven";

class Proxy {
  private readonly dataimpulse: DataimpulseProxy | null = null;
  private readonly nodemaven: NodemavenProxy | null = null;

  constructor(users: IProxyUsers) {
    if (users.dataimpulse) this.dataimpulse = new DataimpulseProxy(users.dataimpulse);
    if (users.nodemaven) this.nodemaven = new NodemavenProxy(users.nodemaven);
  }

  async requestProxy(type: ProxyType, settings: IProxySettings = { sticky: true }): Promise<IProxy> {
    let proxy: IProxy;
    switch (type) {
      case "dataimpulse": {
        if (!this.dataimpulse) throw new Error(`<DATAIMPULSE> Missing User Credentials`);
        proxy = await this.dataimpulse.requestProxy(settings);
        break;
      }
      case "nodemaven": {
        if (!this.nodemaven) throw new Error(`<NODEMAVEN> Missing User Credentials`);
        proxy = await this.nodemaven.requestProxy(settings);
        break;
      }
      default: {
        throw new Error(`unknown proxy type <${type}>`);
      }
    }

    return proxy;
  }
  async releaseProxy(type: ProxyType, proxy: IProxy): Promise<void> {
    switch (type) {
      case "dataimpulse": {
        if (!this.dataimpulse) throw new Error(`<DATAIMPULSE> Missing User Credentials`);
        await this.dataimpulse.releaseProxy(proxy);
        break;
      }
      case "nodemaven": {
        if (!this.nodemaven) throw new Error(`<NODEMAVEN> Missing User Credentials`);
        await this.nodemaven.releaseProxy(proxy);
        break;
      }
      default: {
        throw new Error(`unknown proxy type <${type}>`);
      }
    }
  }
  async clearPool(type: ProxyType) {
    switch (type) {
      case "dataimpulse": {
        if (!this.dataimpulse) throw new Error(`<DATAIMPULSE> Missing User Credentials`);
        return this.dataimpulse.clearPool();
      }
      case "nodemaven": {
        if (!this.nodemaven) throw new Error(`<NODEMAVEN> Missing User Credentials`);
        return this.nodemaven.clearPool();
      }
      default: {
        throw new Error(`unknown proxy type <${type}>`);
      }
    }
  }
  async clearAllPools() {
    await this.clearPool("dataimpulse");
    await this.clearPool("nodemaven");
  }
}

export default Proxy;

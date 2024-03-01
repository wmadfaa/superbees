import * as proxyChain from "proxy-chain";

import ProxyImplementation, { IProxySettings, IProxy, IProxyUser } from "./@implementation";

class DataimpulseProxy extends ProxyImplementation {
  readonly host = "gw.dataimpulse.com";
  private usedPorts = new Set<number>();

  constructor(user: IProxyUser) {
    super(user);
  }

  private getPort() {
    const min = 10000;
    const max = 19000;
    let port: number = 10000;

    if (this.usedPorts.size >= max - min) {
      this.usedPorts.clear();
    }

    do {
      port = Math.floor(Math.random() * (max - min + 1)) + min;
    } while (this.usedPorts.has(port));

    this.usedPorts.add(port);

    return port;
  }

  private getSticky(country?: string) {
    return `http://${this.user.username}${country ? `__cr.${country}` : ""}:${this.user.password}@${this.host}:${this.getPort()}`;
  }

  private getRotating(country?: string) {
    return `http://${this.user.username}${country ? `__cr.${country}` : ""}:${this.user.password}@${this.host}:823`;
  }

  public async requestProxy({ country, sticky }: IProxySettings = {}) {
    const origin = sticky ? this.getSticky(country) : this.getRotating(country);
    const server = await proxyChain.anonymizeProxy(origin);
    const proxy = { origin, server };
    this.pool.push(proxy);

    return proxy;
  }

  public async releaseProxy(proxy: IProxy) {
    const index = this.pool.findIndex((p) => p.server === proxy.server);
    await proxyChain.closeAnonymizedProxy(proxy.server, true);
    this.pool.splice(index, 1);
  }

  public async clearPool() {
    await Promise.all(this.pool.map((proxy) => proxyChain.closeAnonymizedProxy(proxy.server, true)));
    this.pool.splice(0, this.pool.length);
  }
}

export default DataimpulseProxy;

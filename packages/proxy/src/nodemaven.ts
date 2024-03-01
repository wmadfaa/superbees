import * as proxyChain from "proxy-chain";

import ProxyImplementation, { IProxySettings, IProxy, IProxyUser } from "./@implementation";

class NodemavenProxy extends ProxyImplementation {
  readonly host = "gate.nodemaven.com";

  constructor(user: IProxyUser) {
    super(user);
  }

  private getSticky(country = "any") {
    const uid = Math.random().toString(36).substring(2, 15);
    return `http://${this.user.username}-country-${country}-sid-${uid}-filter-medium:${this.user.password}@${this.host}:8080`;
  }

  private getRotating(country = "any") {
    return `http://${this.user.username}-country-${country}-filter-medium:${this.user.password}@${this.host}:8080`;
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

export default NodemavenProxy;

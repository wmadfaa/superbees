export interface IProxySettings {
  country?: string;
  sticky?: boolean;
}

export interface IProxy {
  origin: string;
  server: string;
}

export interface IProxyUser {
  readonly username: string;
  readonly password: string;
}

abstract class ProxyImplementation {
  readonly pool: IProxy[] = [];

  protected constructor(protected readonly user: IProxyUser) {}
  abstract requestProxy(settings?: IProxySettings, sticky?: boolean): Promise<IProxy>;
  abstract releaseProxy(proxy: IProxy): Promise<void>;
  abstract clearPool(): Promise<void>;
}

export default ProxyImplementation;

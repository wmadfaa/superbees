import ax from "axios";
import async from "async";

import { CapsolverError, CapsolverTaskResultError } from "./capsolver-errors";
import { pick } from "lodash";

export interface ICapsolverOptions {
  server?: `https://api.capsolver.com` | `https://api-stable.capsolver.com`;
  clientKey: string;
}

export interface IFunCaptchaProps {
  websiteURL: string;
  websitePublicKey: string;
  funcaptchaApiJSSubdomain: string;
  data?: string;
}

export interface IFunCaptchaResult {
  errorId: 0;
  solution: {
    userAgent: string;
    token: string;
  };
  status: "ready";
}

export interface IReCaptchaV2Props {
  websiteURL: string;
  websiteKey: string;
}

export interface IReCaptchaV2Result {
  errorId: 0;
  errorCode: null;
  errorDescription: null;
  solution: {
    userAgent: string;
    expireTime: number;
    gRecaptchaResponse: string;
  };
  status: "ready";
}

export interface IImageToTextProps {
  body: string;
  websiteURL?: string;
  case?: boolean;
  module?: string;
  score?: number;
}

export interface IImageToTextResult {
  errorId: 0;
  solution: {
    text: string;
  };
  status: "ready";
}

class Capsolver {
  public readonly server: string = `https://api.capsolver.com`;
  public readonly clientKey: string;

  constructor(opts: ICapsolverOptions) {
    if (opts.server) this.server = opts.server;
    this.clientKey = opts.clientKey;
  }

  private response(action: string, response: any) {
    console.log(`Capsolver [ Method: ${action} | Response: ${JSON.stringify(pick(response, "errorId", "taskId", "status"))} ]`);
    if (response.errorId) {
      throw new CapsolverError({ action, errorCode: response.errorCode, errorDescription: response.errorDescription });
    }

    if (action === `getTaskResult` && response?.status !== `ready`) {
      throw new CapsolverTaskResultError({ status: response.status, taskId: response.taskId });
    }

    return response;
  }

  private async createTask(task: any) {
    const res = await ax.post(`/createTask`, { clientKey: this.clientKey, task }, { baseURL: this.server, headers: { "Content-Type": "application/json" } });
    return this.response(`createTask`, res.data);
  }

  private async getTaskResult(taskId: string) {
    const res = await ax.post(`/getTaskResult`, { clientKey: this.clientKey, taskId }, { baseURL: this.server, headers: { "Content-Type": "application/json" } });
    return this.response(`getTaskResult`, res.data);
  }

  public async getBalance() {
    const res = await ax.post(`/getBalance`, { clientKey: this.clientKey }, { baseURL: this.server, headers: { "Content-Type": "application/json" } });
    return this.response(`getBalance`, res.data);
  }

  public async funCaptcha(props: IFunCaptchaProps): Promise<IFunCaptchaResult> {
    const task = await this.createTask({
      type: `FunCaptchaTaskProxyLess`,
      ...props,
    });

    return async.retry({ times: 120, interval: 3000, errorFilter: (error) => error.name === `CapsolverTaskResultError` }, async () => this.getTaskResult(task.taskId));
  }

  public async reCaptchaV2(props: IReCaptchaV2Props): Promise<IReCaptchaV2Result> {
    const task = await this.createTask({
      type: `ReCaptchaV2TaskProxyLess`,
      ...props,
    });

    return async.retry({ times: 120, interval: 3000, errorFilter: (error) => error.name === `CapsolverTaskResultError` }, async () => this.getTaskResult(task.taskId));
  }

  public async imageToText(props: IImageToTextProps): Promise<IImageToTextResult> {
    return async.retry({ times: 120, interval: 3000, errorFilter: (error) => error.name === `CapsolverTaskResultError` }, async () =>
      this.createTask({ type: `ImageToTextTask`, ...props }),
    );
  }
}

export { CapsolverError, CapsolverTaskResultError } from "./capsolver-errors";
export default Capsolver;

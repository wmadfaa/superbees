import ax from "axios";
import async from "async";

import { TwoCaptchaError, TwoCaptchaTaskResultError } from "./2captcha-errors";
import { pick } from "lodash";

export interface I2CaptchaOptions {
  server: string;
  clientKey: string;
}

export interface IFunCaptchaProps {
  websiteURL: string;
  websitePublicKey: string;
  funcaptchaApiJSSubdomain: string;
  data?: string;
  userAgent?: string;
}

export interface IFunCaptchaResult {
  errorId: 0;
  status: "ready";
  solution: {
    token: string;
  };
  cost: string;
  ip: string;
  createTime: number;
  endTime: number;
  solveCount: number;
}

export interface IImageToTextProps {
  body: string;
  phrase?: boolean;
  case?: boolean;
  numeric?: number;
  math?: boolean;
  minLength?: number;
  maxLength?: number;
  comment?: string;
}

export interface IImageToTextResult {
  errorId: 0;
  solution: {
    text: string;
  };
  status: "ready";
}

class TwoCaptcha {
  public readonly server: string = `https://api.2captcha.com`;
  public readonly clientKey: string;

  constructor(opts: I2CaptchaOptions) {
    if (opts.server) this.server = opts.server;
    this.clientKey = opts.clientKey;
  }

  private response(action: string, response: any, taskId?: string) {
    console.log(`Capsolver [ Method: ${action}${taskId ? ` | TaskId: ${taskId}` : ``} | Response: ${JSON.stringify(pick(response, "errorId", "taskId", "status"))}]`);

    if (response.errorId) {
      throw new TwoCaptchaError({ action, errorId: response.errorId });
    }

    if (action === `getTaskResult` && response?.status !== `ready`) {
      throw new TwoCaptchaTaskResultError({ status: response.status, taskId });
    }

    return response;
  }

  private async createTask(task: any) {
    const res = await ax.post(`/createTask`, { clientKey: this.clientKey, task }, { baseURL: this.server, headers: { "Content-Type": "application/json" } });
    return this.response(`createTask`, res.data);
  }

  private async getTaskResult(taskId: string) {
    const res = await ax.post(`/getTaskResult`, { clientKey: this.clientKey, taskId }, { baseURL: this.server, headers: { "Content-Type": "application/json" } });
    return this.response(`getTaskResult`, res.data, taskId);
  }

  public async getBalance() {
    const res = await ax.post(`/getBalance`, { clientKey: this.clientKey }, { baseURL: this.server, headers: { "Content-Type": "application/json" } });
    return this.response(`getBalance`, res.data);
  }

  public async funCaptcha(props: IFunCaptchaProps): Promise<IFunCaptchaResult> {
    const task = await this.createTask({
      type: `FunCaptchaTaskProxyless`,
      ...props,
    });

    return async.retry({ times: 120, interval: 10000, errorFilter: (error) => error.name === `TwoCaptchaTaskResultError` }, async () => this.getTaskResult(task.taskId));
  }

  public async imageToText(props: IImageToTextProps): Promise<IImageToTextResult> {
    const task = await this.createTask({
      type: `ImageToTextTask`,
      ...props,
    });

    return async.retry({ times: 120, interval: 10000, errorFilter: (error) => error.name === `TwoCaptchaTaskResultError` }, async () => this.getTaskResult(task.taskId));
  }
}

export { TwoCaptchaError, TwoCaptchaTaskResultError } from "./2captcha-errors";
export default TwoCaptcha;

import util from "util";

import * as rx from "rxjs";
import { assign, extend, omit } from "lodash";

import pm2 from "pm2";
import logger, { Logger } from "@superbees/logger";

export interface ResponseData<T = unknown, R = unknown> {
  data?: T;
  error?: string;
  next: boolean;
  request: RequestPacket<R>;
}
export interface Response<T = unknown, R = unknown> {
  process: {
    namespace: string;
    name: string;
    pm_id: number;
  };
  raw: { payload: ResponseData<T, R>; type: string };
  at: number;
}

interface RequestPacket<T> {
  data: T;
  type: string;
  topic: string;
}

interface ActionProcess<T = unknown> {
  send(data: T, next?: boolean): void;
  complete(): void;
  error(error: string, next?: boolean): void;
}

export function createResponseStream<T = unknown, R = unknown>(predicate: (value: Response<T, R>) => boolean) {
  return new rx.Observable<ResponseData<T, R>>((subscriber) => {
    pm2.launchBus((err, bus) => {
      if (err) return subscriber.error(err);

      bus.on("process:msg", (packet: Response<T, R>) => {
        if (predicate(packet)) {
          if (packet.raw.payload.error) subscriber.error(packet.raw.payload.error);
          else if (packet.raw.payload.data) {
            subscriber.next(packet.raw.payload);
            if (!packet.raw.payload.next) subscriber.complete();
          } else subscriber.complete();
        }
      });
    });
  });
}

export function createIterableResponseStream<T = unknown, R = unknown>(predicate: (value: Response<T, R>) => boolean): AsyncIterable<ResponseData<T, R>> {
  const stream = createResponseStream<T, R>(predicate);

  async function* internalGenerator(): AsyncGenerator<ResponseData<T, R>> {
    const messages: ResponseData<T, R>[] = [];
    let resolve: (() => void) | null = null;
    const messagePromise = () => new Promise<void>((r) => (resolve = r));

    const subscription = stream.subscribe({
      next: (message) => {
        messages.push(message);
        if (resolve) {
          resolve();
          resolve = null;
        }
      },
      complete: () => {
        if (resolve) {
          resolve();
          resolve = null;
        }
      },
    });

    try {
      while (!subscription.closed || messages.length > 0) {
        if (messages.length === 0 && !subscription.closed) {
          await messagePromise();
        }
        if (messages.length > 0) {
          const msg = messages.shift()!;
          if (msg) yield msg;
        }
      }
    } finally {
      subscription.unsubscribe();
    }
  }

  return {
    [Symbol.asyncIterator]() {
      return internalGenerator();
    },
  };
}

export type ActionLogger = Logger & { start(): void; complete(): void };
export function registerAction<I extends object, O>(topic: string, handler: (data: I, process: ActionProcess<O>, logger: ActionLogger) => void) {
  process.on("message", (packet: RequestPacket<I>) => {
    if (packet.topic === topic) {
      const actionProcess: ActionProcess<any> = {
        send: (data, next = true) => {
          setImmediate(() => {
            const payload: ResponseData<O> = { request: packet, data, next };
            process.send?.({ type: "process:msg", payload });
          });
        },
        complete: () => {
          setImmediate(() => {
            process.send?.({ type: "process:msg", payload: { request: packet, next: false } });
          });
        },
        error: (error, next = false) => {
          setImmediate(() => {
            process.send?.({ type: "process:msg", payload: { request: packet, error, next } });
          });
        },
      };
      const childLogger = logger.child({ tag: topic, ...omit(packet.data, "_", "v", "$0") });
      const mixedLogger = extend({}, childLogger, {
        start: () => {
          childLogger.info(`starting`);
          actionProcess.send(`starting`, true);
        },
        info: (msg: string, ...args: any[]) => {
          childLogger.info(msg, args);
          actionProcess.send(msg);
        },
        warn: (msg: string, ...args: any[]) => {
          childLogger.warn(msg, args);
          actionProcess.send(msg);
        },
        error: (msg: string, next?: boolean, ...args: any[]) => {
          childLogger.error(`${new Error(msg).message}`, args);
          actionProcess.error(`${new Error(msg).message}`, next);
        },
        complete: () => {
          childLogger.info(`completed`);
          actionProcess.send(`completed`, false);
        },
      });
      handler(packet.data, actionProcess, mixedLogger);
    }
  });
}

export async function sendRequestToProcess<RS = unknown, RQ = unknown>(proc_id: number, packet: RequestPacket<RQ>) {
  const __rq_uuid = crypto.randomUUID();
  packet = assign(packet, { __rq_uuid });
  await util.promisify<number, object, void>(pm2.sendDataToProcessId).bind(pm2)(proc_id, packet);

  return {
    request: packet,
    createResponseStream: () =>
      createResponseStream<RS, RQ>((m) => {
        // @ts-ignore
        return m.raw.payload.request["__rq_uuid"] === packet["__rq_uuid"];
      }),
    createIterableResponseStream: () =>
      createIterableResponseStream<RS, RQ>((m) => {
        // @ts-ignore
        return m.raw.payload.request["__rq_uuid"] === packet["__rq_uuid"];
      }),
  };
}

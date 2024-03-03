import util from "util";

import * as rx from "rxjs";
import { isEqual, assign } from "lodash";

import pm2 from "pm2";

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
  error(error: string): void;
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

export function registerAction<I, O>(topic: string, handler: (data: I, process: ActionProcess<O>) => void) {
  process.on("message", (packet: RequestPacket<I>) => {
    if (packet.topic === topic) {
      handler(packet.data, {
        send: (data, next = true) => {
          setImmediate(() => {
            const payload: ResponseData<O> = { request: packet, data, next };
            process.send?.({ type: "process:msg", payload });
          });
        },
        complete: () => {
          setImmediate(() => {
            const payload: ResponseData<O> = { request: packet, next: false };
            process.send?.({ type: "process:msg", payload });
          });
        },
        error: (error) => {
          setImmediate(() => {
            const payload: ResponseData<O> = { request: packet, error, next: false };
            process.send?.({ type: "process:msg", payload });
          });
        },
      });
    }
  });
}

export async function sendRequestToProcess<RS = unknown, RQ = unknown>(proc_id: number, packet: RequestPacket<RQ>) {
  const __rq_uuid = crypto.randomUUID();
  packet = assign(packet, { __rq_uuid });
  await util.promisify<number, object, void>(pm2.sendDataToProcessId).bind(pm2)(proc_id, packet);

  return {
    request: packet,
    createResponseStream: () => createResponseStream<RS, RQ>((m) => isEqual(m.raw.payload.request, packet)),
    createIterableResponseStream: () => createIterableResponseStream<RS, RQ>((m) => isEqual(m.raw.payload.request, packet)),
  };
}

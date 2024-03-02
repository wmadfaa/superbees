import pm2 from "pm2";
import * as rx from "rxjs";

export interface MessageData<T = unknown> {
  data?: T;
  error?: string;
  topic: string;
  next: boolean;
}
export interface Message<T = unknown> {
  process: {
    namespace: string;
    name: string;
    pm_id: number;
  };
  raw: { payload: MessageData<T>; type: string };
  at: number;
}
export function createMessageStream<T = unknown>(predicate: (value: Message<T>) => boolean) {
  return new rx.Observable<MessageData<T>>((subscriber) => {
    pm2.launchBus((err, bus) => {
      if (err) return subscriber.error(err);

      bus.on("process:msg", (packet: Message<T>) => {
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

export function createIterableMessageStream<T = unknown>(predicate: (value: Message<T>) => boolean): AsyncIterable<MessageData<T>> {
  const stream = createMessageStream<T>(predicate);

  async function* internalGenerator(): AsyncGenerator<MessageData<T>> {
    const messages: MessageData<T>[] = [];
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

interface IncomingPacket<T> {
  data: T;
  topic: string;
}

interface ActionProcess<T = unknown> {
  send(data: T, next?: boolean): void;
  complete(): void;
  error(error: string): void;
}

export function registerAction<I, O>(topic: string, handler: (data: I, process: ActionProcess<O>) => void) {
  process.on("message", (packet: IncomingPacket<I>) => {
    if (packet.topic === topic) {
      handler(packet.data, {
        send: (data, next = true) => {
          const payload: MessageData<O> = { topic: packet.topic, data, next };
          return process.send?.({ type: "process:msg", payload });
        },
        complete: () => {
          const payload: MessageData<O> = { topic: packet.topic, next: false };
          return process.send?.({ type: "process:msg", payload });
        },
        error: (error) => {
          const payload: MessageData<O> = { topic: packet.topic, error, next: false };
          return process.send?.({ type: "process:msg", payload });
        },
      });
    }
  });
}

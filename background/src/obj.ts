import { Subject, Observer, Subscription } from "rxjs";

export type ObjSetArgs<T extends object> = Parameters<Required<ProxyHandler<T>>["set"]>;
export type ObjGetArgs<T extends object> = Parameters<Required<ProxyHandler<T>>["get"]>;
export type ObjDeletePropertyArgs<T extends object> = Parameters<Required<ProxyHandler<T>>["deleteProperty"]>;

type FVV<T> = (value: T) => void;
class Obj<T extends object> {
  private __set = new Subject<ObjSetArgs<T>>();
  private __get = new Subject<ObjGetArgs<T>>();
  private __del = new Subject<ObjDeletePropertyArgs<T>>();

  private readonly seed: T;

  constructor(seed: T) {
    this.seed = new Proxy<T>(seed, {
      set: (target, p, newValue, receiver) => {
        this.__set.next([target, p, newValue, receiver]);
        return Reflect.set(target, p, newValue, receiver);
      },
      // get: (target, p, receiver) => {
      //   this.__get.next([target, p, receiver]);
      //   return Reflect.get(target, p, receiver);
      // },
      // deleteProperty: (target, p) => {
      //   this.__del.next([target, p]);
      //   return Reflect.deleteProperty(target, p);
      // },
    });
  }

  get ref() {
    return this.seed;
  }

  subscribe(event: "set", observer: Partial<Observer<ObjSetArgs<T>>> | FVV<ObjSetArgs<T>>): Subscription;
  subscribe(event: "get", observer: Partial<Observer<ObjGetArgs<T>>> | FVV<ObjGetArgs<T>>): Subscription;
  subscribe(event: "del", observer: Partial<Observer<ObjDeletePropertyArgs<T>>> | FVV<ObjDeletePropertyArgs<T>>): Subscription;
  subscribe(
    event: "set" | "get" | "del",
    observer: Partial<Observer<ObjSetArgs<T> | ObjGetArgs<T> | ObjDeletePropertyArgs<T>>> | FVV<ObjSetArgs<T> | ObjGetArgs<T> | ObjDeletePropertyArgs<T>>,
  ): Subscription {
    return {
      set: this.__set.asObservable().subscribe(observer),
      get: this.__get.asObservable().subscribe(observer),
      del: this.__del.asObservable().subscribe(observer),
    }[event];
  }
}

export default Obj;

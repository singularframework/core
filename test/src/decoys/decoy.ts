import { DecoyHistory } from '../models';

export class Decoy<T> {

  protected __history: DecoyHistory[] = [];

  public get history() { return this.__history; }

  public clearHistory() { this.__history = []; }

  public get decoy(): T { return <any>this; }

}

export function ObjectDecoy(namespace: string, object: any, history: DecoyHistory[]) {

  return new Proxy(object, new ObjectProxy(history, namespace));

}

class ObjectProxy<T extends Object> implements ProxyHandler<T> {

  constructor(
    protected __history: DecoyHistory[],
    protected __namespace: string
  ) { }

  public get(target: any, prop: string) {

    this.__history.push({
      type: 'property-get',
      name: `${this.__namespace}.${prop.toString()}`
    });

    return target[prop];

  }

  public set(target: any, prop: string, value: any): boolean {

    this.__history.push({
      type: 'property-set',
      name: `${this.__namespace}.${prop.toString()}`,
      value
    });

    target[prop] = value;

    return true;

  }

}

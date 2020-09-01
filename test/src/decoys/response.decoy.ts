import { Response } from '../../../dist/core';
import { FunctionHistory } from '../models';

export class ResponseDecoy {

  private __history: FunctionHistory[] = [];

  public status(...args: any[]) {

    this.__history.push({
      name: 'status',
      args
    });

    return this;

  }

  public json(...args: any[]) {

    this.__history.push({
      name: 'json',
      args
    });

    return this;

  }

  public get history() { return this.__history; }

  public clearHistory() { this.__history = []; }

  public get decoy(): Response { return <any>this; }

}

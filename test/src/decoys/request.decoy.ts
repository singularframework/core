import { Request } from '../../../dist/core';
import { FunctionHistory } from '../models';

export class RequestDecoy {

  private __history: FunctionHistory[] = [];

  public sessionId: string;

  public get history() { return this.__history; }

  public clearHistory() { this.__history = []; }

  public get decoy(): Request { return <any>this; }

}

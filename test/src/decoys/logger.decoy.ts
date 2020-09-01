import { ServerLogger } from '../../../dist/logger';
import { FunctionHistory } from '../models';

export class LoggerDecoy {

  private __history: FunctionHistory[] = [];

  public debug(...args: any[]) {

    this.__history.push({
      name: 'debug',
      args
    });

  }

  public info(...args: any[]) {

    this.__history.push({
      name: 'info',
      args
    });

  }

  public notice(...args: any[]) {

    this.__history.push({
      name: 'notice',
      args
    });

  }

  public warn(...args: any[]) {

    this.__history.push({
      name: 'warn',
      args
    });

  }

  public id(...args: any[]) {

    this.__history.push({
      name: 'id',
      args
    });

    return this;

  }

  public get history() { return this.__history; }

  public clearHistory() { this.__history = []; }

  public get decoy(): ServerLogger { return <any>this; }

}

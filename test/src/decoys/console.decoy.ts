import { FunctionHistory } from '../models';

export class ConsoleDecoy {

  private __history: FunctionHistory[] = [];

  public debug(...args: any[]) {

    this.__history.push({
      name: 'debug',
      args
    });

  }

  public log(...args: any[]) {

    this.__history.push({
      name: 'log',
      args
    });

  }

  public warn(...args: any[]) {

    this.__history.push({
      name: 'warn',
      args
    });

  }

  public error(...args: any[]) {

    this.__history.push({
      name: 'error',
      args
    });

  }

  public get history() { return this.__history; }

  public clearHistory() { this.__history = []; }

}

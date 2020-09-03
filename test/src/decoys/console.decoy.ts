import { Decoy } from './decoy';

export class ConsoleDecoy extends Decoy<Console> {

  public debug(...args: any[]) {

    this.__history.push({
      name: 'debug',
      args,
      type: 'function'
    });

  }

  public log(...args: any[]) {

    this.__history.push({
      name: 'log',
      args,
      type: 'function'
    });

  }

  public warn(...args: any[]) {

    this.__history.push({
      name: 'warn',
      args,
      type: 'function'
    });

  }

  public error(...args: any[]) {

    this.__history.push({
      name: 'error',
      args,
      type: 'function'
    });

  }

}

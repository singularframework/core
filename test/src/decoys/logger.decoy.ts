import { ServerLogger } from '../../../dist/logger';
import { Decoy } from './decoy';

export class LoggerDecoy extends Decoy<ServerLogger> {

  public debug(...args: any[]) {

    this.__history.push({
      name: 'debug',
      args,
      type: 'function'
    });

  }

  public info(...args: any[]) {

    this.__history.push({
      name: 'info',
      args,
      type: 'function'
    });

  }

  public notice(...args: any[]) {

    this.__history.push({
      name: 'notice',
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

  public id(...args: any[]) {

    this.__history.push({
      name: 'id',
      args,
      type: 'function'
    });

    return this;

  }

}

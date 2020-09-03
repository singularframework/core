import { Response } from '../../../dist/core';
import { Decoy } from './decoy';

export class ResponseDecoy extends Decoy<Response> {

  public status(...args: any[]) {

    this.__history.push({
      name: 'status',
      args,
      type: 'function'
    });

    return this;

  }

  public json(...args: any[]) {

    this.__history.push({
      name: 'json',
      args,
      type: 'function'
    });

    return this;

  }

  public cookie(...args: any[]) {

    this.__history.push({
      name: 'cookie',
      args,
      type: 'function'
    });

    return this;

  }

}

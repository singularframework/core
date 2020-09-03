import { NextFunction } from '../../../dist/core';
import { Decoy } from './decoy'

export class NextDecoy extends Decoy<any> {

  private __thenResolve: Function;
  private __thenResolved = false;

  /**
  * Returns a promise which will be resolved when decoy is called.<br><br>
  * ONLY CALL THIS METHOD ONCE, OTHERWISE PREVIOUS CALLS WILL NEVER BE RESOLVED.<br>
  * Call next.reset() to be able to use this method again.
  */
  public then(): Promise<void> {

    return new Promise(resolve => {

      if ( this.__thenResolved ) return resolve();

      this.__thenResolved = false;
      this.__thenResolve = resolve;

    });

  }

  public get decoy(): NextFunction {

    return () => {

      this.__history.push({
        type: 'function',
        name: 'next'
      });

      this.__thenResolved = true;
      if ( this.__thenResolve ) this.__thenResolve();

    };

  }

  public reset() {

    this.__thenResolve = undefined;
    this.__thenResolved = false;

  }

}

import { Request } from '../../../dist/core';
import { Decoy, ObjectDecoy } from './decoy'

export class RequestDecoy extends Decoy<Request> {

  private __sessionId: string;
  private __cookies = {};
  private __cookiesDecoy = ObjectDecoy('cookies', this.__cookies, this.__history);
  private __signedCookies = {};
  private __signedCookiesDecoy = ObjectDecoy('signedCookies', this.__signedCookies, this.__history);

  public get sessionId(): string {

    this.__history.push({
      type: 'property-get',
      name: 'sessionId'
    });

    return this.__sessionId;

  }

  public set sessionId(value: string) {

    this.__history.push({
      type: 'property-set',
      name: 'sessionId',
      value
    });

    this.__sessionId = value;

  }

  public get cookies(): any {

    this.__history.push({
      type: 'property-get',
      name: 'cookies'
    });

    return this.__cookiesDecoy;

  }

  public set cookies(value: any) {

    this.__cookies = value;

  }

  public get signedCookies(): any {

    return this.__signedCookiesDecoy;

  }

  public set signedCookies(value: any) {

    this.__history.push({
      type: 'property-set',
      name: 'signedCookies',
      value
    });

    this.__signedCookies = value;

  }

}

import { Request } from '../../../dist/core';
import { Decoy, ObjectDecoy } from './decoy'

export class RequestDecoy extends Decoy<Request> {

  private __sessionId: string;
  private __cookies = {};
  private __cookiesDecoy = ObjectDecoy('cookies', this.__cookies, this.__history);
  private __signedCookies = {};
  private __signedCookiesDecoy = ObjectDecoy('signedCookies', this.__signedCookies, this.__history);
  private __protocol: string;
  private __originalUrl: string;
  private __headers = {};
  private __headersDecoy = ObjectDecoy('headers', this.__headers, this.history);
  private __body = {};
  private __bodyDecoy = ObjectDecoy('headers', this.__body, this.history);
  private __query = {};
  private __queryDecoy = ObjectDecoy('headers', this.__query, this.history);

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

  public get protocol(): string {

    this.__history.push({
      type: 'property-get',
      name: 'protocol'
    });

    return this.__protocol;

  }

  public set protocol(value: string) {

    this.__history.push({
      type: 'property-set',
      name: 'protocol',
      value
    });

    this.__protocol = value;

  }

  public get originalUrl(): string {

    this.__history.push({
      type: 'property-get',
      name: 'originalUrl'
    });

    return this.__originalUrl;

  }

  public set originalUrl(value: string) {

    this.__history.push({
      type: 'property-set',
      name: 'originalUrl',
      value
    });

    this.__originalUrl = value;

  }

  public get cookies(): any {

    this.__history.push({
      type: 'property-get',
      name: 'cookies'
    });

    return this.__cookiesDecoy;

  }

  public set cookies(value: any) {

    this.__history.push({
      type: 'property-set',
      name: 'cookies',
      value
    });

    this.__cookies = value;
    this.__cookiesDecoy = ObjectDecoy('cookies', this.__cookies, this.__history);

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
    this.__signedCookiesDecoy = ObjectDecoy('cookies', this.__signedCookies, this.__history);

  }

  public get headers(): any {

    return this.__headersDecoy;

  }

  public set headers(value: any) {

    this.__history.push({
      type: 'property-set',
      name: 'headers',
      value
    });

    this.__headers = value;
    this.__headersDecoy = ObjectDecoy('cookies', this.__headers, this.__history);

  }

  public get body(): any {

    return this.__bodyDecoy;

  }

  public set body(value: any) {

    this.__history.push({
      type: 'property-set',
      name: 'body',
      value
    });

    this.__body = value;
    this.__bodyDecoy = ObjectDecoy('cookies', this.__body, this.__history);

  }

  public get query(): any {

    return this.__queryDecoy;

  }

  public set query(value: any) {

    this.__history.push({
      type: 'property-set',
      name: 'query',
      value
    });

    this.__query = value;
    this.__queryDecoy = ObjectDecoy('cookies', this.__query, this.__history);

  }

  public get(name: string): string {

    this.__history.push({
      type: 'function',
      name: 'get',
      args: [name]
    });

    return this.__headersDecoy[name];

  }

}

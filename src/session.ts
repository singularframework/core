import { Request, Response, NextFunction } from '@singular/common';

export class ServerSessionManager {

  protected __handlers: SessionHandlers = {};

  constructor(
    protected __enabled: boolean
  ) { }

  /**
  * Assigns a handler to a session event.
  * @param event A session event name.
  * @param handler An event handler.
  */
  public on(event: 'created', handler: SessionHandlers['created']): this;
  public on(event: 'claim:get', handler: SessionHandlers['claim:get']): this;
  public on(event: 'claim:set', handler: SessionHandlers['claim:set']): this;
  public on(event: string, handler: (...args: any[]) => any|Promise<any>): this {

    if ( ! this.__enabled ) {

      log.warn(`Session management is disabled!`);
      return this;

    }

    if ( ! ['created', 'claim:get', 'claim:set'].includes(event) ) {

      log.error(`Event '${event}' does not exist on session!`);
      return this;

    }

    if ( this.__handlers[event] ) {

      log.error(`Session's '${event}' event has already been assigned a handler!`);
      return this;

    }

    this.__handlers[event] = handler;

    return this;

  }

  /**
  * Sets a session claim using a pre-assigned handler.
  * @param id A session ID.
  * @param key A claim key.
  * @param value A claim value.
  */
  public setClaim(id: string, key: string, value: any): void|Promise<void> {

    if ( ! this.__enabled ) {

      log.warn(`Session management is disabled!`);
      return;

    }

    if ( ! this.__handlers['claim:set'] ) {

      log.warn(`Session event 'claim:set' has no handler assigned!`);
      return;

    }

    return this.__handlers['claim:set'](id, key, value);

  }

  /**
  * Retreives a claim using a pre-assigned handler.
  * @param id A session ID.
  * @param key A claim key.
  */
  public getClaim(id: string, key: string): any|Promise<any> {

    if ( ! this.__enabled ) {

      log.warn(`Session management is disabled!`);
      return;

    }

    if ( ! this.__handlers['claim:get'] ) {

      log.warn(`Session event 'claim:get' has no handler assigned!`);
      return;

    }

    return this.__handlers['claim:get'](id, key);

  }

}

export class ServerSessionManagerInternal extends ServerSessionManager {

  constructor(
    __enabled: boolean,
    private __signed: boolean
  ) {

    super(__enabled);

  }

  private __generateSessionId(): string {

    const charset = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789';
    let id: string = '';

    for ( let i = 0; i < 20; i++ ) {

      id += charset[Math.floor(Math.random() * charset.length)];

    }

    return id;

  }

  public middleware(req: Request, res: Response, next: NextFunction) {

    const cookies = this.__signed ? req.signedCookies : req.cookies;

    // Extract session ID
    if ( cookies.sessionId ) {

      req.sessionId = cookies.sessionId;

      next();

    }
    // Generate new session ID
    else {

      req.sessionId = this.__generateSessionId();

      res.cookie('sessionId', req.sessionId, { signed: this.__signed });

      // Run created handler
      (async () => await this.__handlers?.created(req.sessionId))()
      .catch(error => {

        log.error(`Session's created event threw an error!`, error);

      })
      .finally(() => next());

    }

  }

}

interface SessionHandlers {

  created?: (id: string) => void|Promise<void>;
  ['claim:get']?: (id: string, key: string) => any|Promise<any>;
  ['claim:set']?: (id: string, key: string, value: any) => void|Promise<void>;

}

export class ServerEventManager {

  private __events: List<EventListeners> = {};

  private __emitEvent(event: string, once: boolean, args: any[]) {

    if ( this.__events[event].once ) return;

    this.__events[event].args = args;
    this.__events[event].once = once;

    for ( let i = 0; i < this.__events[event].listeners.length; i++ ) {

      this.__callListener(event, this.__events[event].listeners[i].listener);

      if ( this.__events[event].listeners[i].once ) {

        this.__events[event].listeners.splice(i, 1);
        i--;

      }

    }

  }

  private __initEvent(event: string) {

    this.__events[event] = {
      args: [],
      once: false,
      listeners: []
    };

  }

  private async __callListener(event: string, listener: EventListener) {

    try {

      await listener(...this.__events[event].args);

    }
    catch (error) {

      log.error(`An event listener threw an error on event "${event}":`, error);

    }

  }

  /**
  * Adds a listener to an event.
  * @param event An event name.
  * @param listener An event listener.
  */
  public on(event: string, listener: EventListener): this {

    if ( ! this.__events.hasOwnProperty(event) ) this.__initEvent(event);

    if ( this.__events[event].once ) this.__callListener(event, listener);
    else this.__events[event].listeners.push({
      once: false,
      listener
    });

    return this;

  }

  /**
  * Adds a listener to an event and removes it after the event emits.
  * @param event An event name.
  * @param listener An event listener.
  */
  public once(event: string, listener: EventListener): this {

    if ( ! this.__events.hasOwnProperty(event) ) this.__initEvent(event);

    if ( this.__events[event].once ) this.__callListener(event, listener);
    else this.__events[event].listeners.push({
      once: true,
      listener
    });

    return this;

  }

  /**
  * Removes a listener from an event.
  * @param event An event name.
  * @param listener A listener to remove.
  */
  public off(event: string, listener: EventListener): this {

    if ( this.__events.hasOwnProperty(event) ) {

      for ( let i = 0; i < this.__events[event].listeners.length; i++ ) {

        if ( this.__events[event].listeners[i].listener === listener ) {

          this.__events[event].listeners.splice(i, 1);
          break;

        }

      }

    }

    return this;

  }

  /**
  * Emits an event with the provided arguments.
  * @param event An event name.
  * @param args Arguments to pass to listeners.
  */
  public emit(event: string, ...args: any[]): this {

    if ( ! this.__events.hasOwnProperty(event) ) this.__initEvent(event);

    this.__emitEvent(event, false, args);

    return this;

  }

  /**
  * Emits an event once with the provided arguments.
  * All future registered event handlers will be called immediately with these arguments.
  * This event cannot be emitted anymore.
  * @param event An event name.
  * @param args Arguments to pass to listeners.
  */
  public emitOnce(event: string, ...args: any[]): this {

    if ( ! this.__events.hasOwnProperty(event) ) this.__initEvent(event);

    this.__emitEvent(event, true, args);

    return this;

  }

  /**
  * Returns a list of event names.
  */
  public eventNames(): string[] {

    return Object.keys(this.__events);

  }

  /**
  * Adds a listener to an event.
  * @param event An event name.
  * @param listener An event listener.
  */
  public addListener(event: string, listener: EventListener): this {

    return this.on(event, listener);

  }

  /**
  * Adds a listener to an event and removes it after the event emits.
  * @param event An event name.
  * @param listener An event listener.
  */
  public addOnceListener(event: string, listener: EventListener): this {

    return this.once(event, listener);

  }

  /**
  * Removes a listener from an event.
  * @param event An event name.
  * @param listener The listener to remove.
  */
  public removeListener(event: string, listener: EventListener): this {

    return this.off(event, listener);

  }

  /**
  * Removes all listeners of an event.
  * @param event An event name.
  */
  public removeAllListeners(event: string): this {

    if ( ! this.__events.hasOwnProperty(event) ) return this;

    this.__events[event].listeners = [];

    return this;

  }

  /**
  * Returns the number of listeners for an event.
  * @param event An event name.
  */
  public listenersCount(event: string): number {

    if ( ! this.__events.hasOwnProperty(event) ) return 0;

    return this.__events[event].listeners.length;

  }

  /**
  * Prepends a listener to an event.
  * @param event An event name.
  * @param listener An event listener.
  */
  public prependListener(event: string, listener: EventListener): this {

    if ( ! this.__events.hasOwnProperty(event) ) this.__initEvent(event);

    if ( this.__events[event].once ) this.__callListener(event, listener);
    else this.__events[event].listeners.unshift({
      once: false,
      listener
    });

    return this;

  }

  /**
  * Prepends a listener to an event and removes it after the event emits.
  * @param event An event name.
  * @param listener An event listener.
  */
  public prependOnceListener(event: string, listener: EventListener): this {

    if ( ! this.__events.hasOwnProperty(event) ) this.__initEvent(event);

    if ( this.__events[event].once ) this.__callListener(event, listener);
    else this.__events[event].listeners.push({
      once: true,
      listener
    });

    return this;

  }

  /**
  * Returns all listeners for an event.
  * @param event An event name.
  */
  public getListeners(event: string): Array<EventListener> {

    if ( ! this.__events.hasOwnProperty(event) ) return [];

    return this.__events[event].listeners.map(l => l.listener);

  }

  /**
  * Returns the listeners array for an event.
  * @param event An event name.
  */
  public getRawListeners(event: string): Array<EventListenerWrapper> {

    if ( ! this.__events.hasOwnProperty(event) ) return [];

    return Array.from(this.__events[event].listeners);

  }

}

interface List<T> {

  [name: string]: T;

}

interface EventListeners {

  args: Array<any>;
  once: boolean;
  listeners: Array<EventListenerWrapper>;

}

interface EventListenerWrapper {

  once: boolean;
  listener: EventListener;

}

type EventListener = (...args: any[]) => void|Promise<void>;

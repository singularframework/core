import 'source-map-support/register';
import { Singular as SingularClass } from './singular';
import { ServerLogger } from './logger';
import { ServerEventManager } from './events';
import { ServerSessionManager } from './session';
import { ServerError as ServerErrorConstructor } from './error';

declare global {

  /** Global logger. */
  const log: ServerLogger;
  /** Global event manager. */
  const events: ServerEventManager;
  /** Global session manager. */
  const session: ServerSessionManager;
  /** Global server error constructor. */
  const ServerError: typeof ServerErrorConstructor;
  /** Root directory path. */
  const __rootdir: string;

}

export * from '@singular/common';
export * from './decorators';
export * from './plugins';
export const Singular = new SingularClass();

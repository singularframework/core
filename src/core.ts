import 'source-map-support/register';
import { Singular as SingularClass } from './singular';
import { ServerLogger } from './logger';
import { ServerEventManager } from './events';
import { ServerSessionManager } from './session';
import { ServerError } from './error';

declare global {

  const log: ServerLogger;
  const events: ServerEventManager;
  const session: ServerSessionManager;
  const ServerError: ServerError;

}

export * from '@singular/common';
export * from './decorators';
export const Singular = new SingularClass();

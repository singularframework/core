import { Express } from 'express';
import { ServerConfig, ModuleType, RouteDefinition, CORSPolicy } from '@singular/common';
import { CachedLog } from './singular';
import chalk from 'chalk';

export namespace PluginHooks {

  export interface BeforeConfig {

    beforeConfig(log: PluginLogger, data: PluginDataBeforeConfig): void|Promise<void>;

  }

  export interface AfterConfig {

    afterConfig(log: PluginLogger, data: PluginDataAfterConfig): void|Promise<void>;

  }

  export interface BeforeInternalMiddleware {

    beforeInternalMiddleware(log: PluginLogger, data: PluginDataBeforeInternalMiddleware): void|Promise<void>;

  }

  export interface AfterInternalMiddleware {

    afterInternalMiddleware(log: PluginLogger, data: PluginDataAfterInternalMiddleware): void|Promise<void>;

  }

  export interface BeforeUserMiddleware {

    beforeUserMiddleware(log: PluginLogger, data: PluginDataBeforeUserMiddleware): void|Promise<void>;

  }

  export interface AfterUserMiddleware {

    afterUserMiddleware(log: PluginLogger, data: PluginDataAfterUserMiddleware): void|Promise<void>;

  }

  export interface BeforeLaunch {

    beforeLaunch(log: PluginLogger, data: PluginDataBeforeLaunch): void|Promise<void>;

  }

  export interface AfterLaunch {

    afterLaunch(log: PluginLogger, data: PluginDataAfterLaunch): void|Promise<void>;

  }

}

export interface PluginDataBeforeConfig {

  /** The Express application used internally by Singular. */
  app: Express;
  /** The absolute path of the root directory. */
  rootdir: string;
  /** The registered config profiles. */
  profiles: { [name: string]: ServerConfig };

}

export interface PluginDataAfterConfig extends PluginDataBeforeConfig {

  /** The resolved config object (immutable). */
  config: ServerConfig;

}

export interface PluginDataBeforeInternalMiddleware extends PluginDataAfterConfig {

  /** Installed components (not initialized). */
  components: {
    routers: { [name: string]: PluginSingularComponent<'router'>; };
    services: { [name: string]: PluginSingularComponent<'service'>; };
  };

}

export interface PluginDataAfterInternalMiddleware extends PluginDataBeforeInternalMiddleware {}

export interface PluginDataBeforeUserMiddleware extends PluginDataAfterInternalMiddleware {}

export interface PluginDataAfterUserMiddleware extends PluginDataBeforeUserMiddleware {}

export interface PluginDataBeforeLaunch extends PluginDataAfterUserMiddleware {

  /** Installed components (initialized). */
  components: {
    routers: { [name: string]: PluginSingularComponent<'router'>; };
    services: { [name: string]: PluginSingularComponent<'service'>; };
  };

}

export interface PluginDataAfterLaunch extends PluginDataBeforeLaunch {}

export interface PluginSingularComponent<T extends 'service'|'router' = any> {

  metadata: PluginSingularComponentMetadata<T>;
  onInit?(): void|Promise<void>;
  onInjection?(services: any): void|Promise<void>;
  onConfig?(config: ServerConfig): void|Promise<void>;

}

export interface PluginSingularComponentMetadata<T extends 'service'|'router' = any> {

  name: string;
  type: (T extends 'service' ? ModuleType.Service : ModuleType.Router);
  priority: number;
  routes?: (T extends 'router' ? Array<RouteDefinition> : undefined);
  corsPolicy?: (T extends 'router' ? CORSPolicy : undefined);

}

export class PluginLogger {

  constructor(
    private __cachedLogs: CachedLog[],
    private __name: string
  ) { }

  /**
  * Prints a message at debug level.
  */
  public debug(message: any, ...additionalMessages: any[]) {

    const logMessage = `${chalk.cyan(`[${this.__name}]`)} ${[].concat(message, ...additionalMessages).join(' ')}`;

    if ( log ) log.debug(logMessage);
    else this.__cachedLogs.push({
      level: 'debug',
      message: logMessage
    });

  }

  /**
  * Prints a message at info level.
  */
  public info(message: any, ...additionalMessages: any[]) {

    const logMessage = `${chalk.cyan(`[${this.__name}]`)} ${[].concat(message, ...additionalMessages).join(' ')}`;

    if ( log ) log.info(logMessage);
    else this.__cachedLogs.push({
      level: 'info',
      message: logMessage
    });

  }

  /**
  * Prints a message at notice level.
  */
  public notice(message: any, ...additionalMessages: any[]) {

    const logMessage = `${chalk.cyan(`[${this.__name}]`)} ${[].concat(message, ...additionalMessages).join(' ')}`;

    if ( log ) log.notice(logMessage);
    else this.__cachedLogs.push({
      level: 'notice',
      message: logMessage
    });

  }

  /**
  * Prints a message at warn level.
  */
  public warn(message: any, ...additionalMessages: any[]) {

    const logMessage = `${chalk.cyan(`[${this.__name}]`)} ${[].concat(message, ...additionalMessages).join(' ')}`;

    if ( log ) log.warn(logMessage);
    else this.__cachedLogs.push({
      level: 'warn',
      message: logMessage
    });

  }

  /**
  * Prints a message at error level.
  */
  public error(message: any, ...additionalMessages: any[]) {

    const logMessage = `${chalk.cyan(`[${this.__name}]`)} ${[].concat(message, ...additionalMessages).join(' ')}`;

    if ( log ) log.error(logMessage);
    else this.__cachedLogs.push({
      level: 'error',
      message: logMessage
    });

  }

}

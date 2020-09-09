import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { URL } from 'url';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { DateTime } from 'luxon';
import * as tsConfigPaths from 'tsconfig-paths';
import { ServerLogger, ServerLoggerCore } from './logger';
import { ServerEventManager } from './events';
import { ServerSessionManagerInternal } from './session';
import { ServerError as ServerErrorConstructor } from './error';
import { RequestHandler, Request as OriginalRequest } from 'express';
import callsites from 'callsites';
import http from 'http';
import https from 'https';
import {
  Request,
  Response,
  NextFunction,
  ServerConfig,
  BasicModule,
  ModuleType,
  RouteDefinition,
  ValidationRule,
  AggregationTarget,
  PipeFunction,
  AsyncPipeFunction,
  TransformationDefinition,
  BodyTransformationDefinition,
  ExecutablePipes,
  TransformationRule,
  ValidatorFunction,
  AsyncValidatorFunction,
  ValidationDefinition,
  BodyValidationDefinition,
  ExecutableValidators,
} from '@singular/common';

import {
  PluginDataBeforeConfig,
  PluginDataAfterConfig,
  PluginDataBeforeInternalMiddleware,
  PluginDataAfterInternalMiddleware,
  PluginDataBeforeUserMiddleware,
  PluginDataAfterUserMiddleware,
  PluginDataBeforeLaunch,
  PluginDataAfterLaunch,
  PluginLogger
} from './plugins';

export class Singular {

  /** Server config defaults. */
  private static __CONFIG_DEFAULT: ServerConfig = {
    https: false,
    httpsPort: 443,
    httpsOnly: true,
    port: 80,
    predictive404: false,
    predictive404Priority: Infinity,
    timezone: DateTime.local().zone.name,
    colorfulLogs: true,
    writeLogsToFile: true,
    logFileLevels: 'all',
    consoleLogLevels: ['info', 'notice', 'warn', 'error'],
    logFileMaxAge: 7,
    archiveLogs: true,
    fileUploadLimit: '10mb',
    excludeHeadersInLogs: [],
    logRequestHeaders: false,
    logResponseMessages: true,
    excludeQueryParamsInLogs: [],
    sessionManagement: false,
    cookieSecret: undefined,
    enableCors: false
  };
  /** Current server config. */
  private __config: ServerConfig = null;
  /** Config profiles. */
  private __configProfiles: ConfigProfiles = {};
  /** Express app. */
  private __app = express();
  /** Installed router components. */
  private __routers: SingularComponent[] = [];
  /** Installed service components. */
  private __services: SingularComponent[] = [];
  /** Logs produced before the logger was initialized. */
  private __cachedLogs: CachedLog[] = [];
  /** Installed plugins. */
  private __plugins: Array<InstalledPlugin> = [];
  /** The data to provide to plugins at different stages. */
  private __pluginData: any = {};

  /** Initializes all globals (config must be loaded before calling this method). */
  private __initGlobals() {

    (<any>global).events = new ServerEventManager();
    (<any>global).ServerError = ServerErrorConstructor;
    (<any>global).log = new ServerLogger(new ServerLoggerCore(this.__config));
    (<any>global).session = new ServerSessionManagerInternal(!! this.__config.sessionManagement, !! this.__config.cookieSecret);

    // Set error response logs
    (<any>global).ServerError.__logResponseErrors = this.__config.logResponseErrors;

  }

  /** Sanitizes the config object (must be run right after config is loaded). */
  private __sanitizeConfig(config: ServerConfig) {

    config.excludeHeadersInLogs = config.excludeHeadersInLogs.map(h => h.toLowerCase());
    config.excludeHeadersInLogs.push('authorization'); // Hide authorization header by default

  }

  /** Scans the given directory recursively and returns a list of files. */
  private __scanDirRec(dir: string): string[] {

    const all: string[] = fs.readdirSync(dir);
    let files: string[] = [];
    const dirs: string[] = [];

    for ( const item of all ) {

      const stat = fs.statSync(path.join(dir, item));

      if ( ! stat ) continue;

      if ( stat.isDirectory() ) dirs.push(item);
      if ( stat.isFile() ) files.push(path.join(dir, item));

    }

    for ( const item of dirs ) {

      files = _.concat(files, this.__scanDirRec(path.join(dir, item)));

    }

    return files;

  }

  /** Installs a component from filename. */
  private __installComponent(filename: string) {

    const modules: any[] = _.values(require(filename));

    for ( const module of modules ) {

      if ( typeof module !== 'function' ) continue;

      try {

        const initializedModule: BasicModule = new module();

        if ( ! initializedModule.__metadata ) continue;

        if ( initializedModule.__metadata.type === ModuleType.Service ) {

          this.__services.push({
            name: initializedModule.__metadata.name,
            module: initializedModule
          });

          // Cache log so it will be logged when the logger gets initialized
          this.__cachedLogs.push({ level: 'debug', message: `Service "${initializedModule.__metadata.name}" installed` });

        }
        else if ( initializedModule.__metadata.type === ModuleType.Router ) {

          this.__routers.push({
            name: initializedModule.__metadata.name,
            module: initializedModule
          });

          // Cache log so it will be logged when the logger gets initialized
          this.__cachedLogs.push({ level: 'debug', message: `Router "${initializedModule.__metadata.name}" installed` });

        }

      }
      catch {

        continue;

      }

    }

  }

  /** Mounts all default middleware that should sit on top of the stack. */
  private __mountDefaultTopMiddleware() {

    // Install cookie parser
    this.__app.use(cookieParser(this.__config.cookieSecret));

    // Install cookie parser error handler
    this.__app.use((error: Error, req: Request, res: Response, next: NextFunction) => {

      new ServerError('Invalid cookies!', 400, 'INVALID_COOKIES').respond(res, req);

    });

    log.debug('Cookie parser middleware has been installed');

    // Install session manager middleware
    if ( this.__config.sessionManagement ) {

      this.__app.use((<ServerSessionManagerInternal>session).middleware.bind(session));

      log.debug('Session manager middleware has been installed');

    }

    // Install body parsers
    this.__app.use(bodyParser.text());
    this.__app.use(bodyParser.json());
    this.__app.use(bodyParser.urlencoded({ extended: true }));
    this.__app.use(bodyParser.raw({ type: 'application/octet-stream', limit: this.__config.fileUploadLimit }));

    // Install body parsing error
    this.__app.use((error: Error, req: Request, res: Response, next: NextFunction) => {

      new ServerError('Invalid body!', 400, 'INVALID_BODY').respond(res, req);

    });

    log.debug('Body parser middleware have been installed');

  }

  /** Renders a request path (and headers if withHeaders is true) for logging considering server config and allowed headers and queries in logs.
  *
  * ANSI CHARACTERS MAY BE PRESENT INSIDE THE RENDERED STRINGS, THEREFORE THEY SHOULD BE ONLY USED FOR LOGGING.
  */
  private __getLogPath(req: OriginalRequest): string;
  private __getLogPath(req: OriginalRequest, withHeaders: true): { path: string; headers: string };
  private __getLogPath(req: OriginalRequest, withHeaders?: boolean): any {

    // Parse URL
    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const result = {
      headers: undefined,
      path: undefined
    };

    // Hide params based on config
    for ( const param of url.searchParams.keys() ) {

      if ( this.__config.excludeQueryParamsInLogs.includes(param) )
        url.searchParams.set(param, '__HIDDEN__');

    }

    result.path = url.toString().replace(/__HIDDEN__/g, chalk.magenta('HIDDEN'));

    // Log headers
    if ( withHeaders && this.__config.logRequestHeaders ) {

      // Hide headers based on config
      const headersLog: string[] = [chalk.bold('HEADERS')];

      for ( const header in req.headers ) {

        headersLog.push(`${header}: ${this.__config.excludeHeadersInLogs.includes(header) ? chalk.magenta('HIDDEN') : req.headers[header]}`);

      }

      result.headers = headersLog.join('\n');

    }

    return withHeaders ? result : result.path;

  }

  /** Mounts the predictive 404 middleware. */
  private __mountPredictive404() {

    this.__app.use('*', (req: Request, res, next) => {

      let matches: number = 0;

      this.__app._router.stack.map(layer => {

        if ( layer.regexp.fast_star || layer.regexp.fast_slash ) return;

        if ( layer.match(req.originalUrl) ) matches++;

      });

      if ( matches ) next();
      else new ServerError(`Route ${this.__getLogPath(req)} not found!`, 404, 'ROUTE_NOT_FOUND').respond(res, req);

    });

  }

  /** Determines whether object is a validation rule. */
  private __isValidationRule(object: any): object is ValidationRule {

    return 'validator' in object;

  }

  /** Determines whether object is a transformation rule. */
  private __isTransformationRule(object: any): object is TransformationRule {

    return 'transformer' in object;

  }

  /** Determines if object is executable. */
  private __isExecutable<T>(object: any): object is T {

    return '__exec' in object && typeof object.__exec === 'function';

  }

  /** Generates a generic message for a validation error. */
  private __generateValidationErrorMessage(targetName: 'header'|'query'|'body'|'param', valuePath: string[]): string {

    if ( valuePath.length ) {

      return `Invalid value for ${targetName === 'body' ? targetName + ' property' : targetName} "${valuePath.join('.')}"!`;

    }
    else {

      return `Invalid value in ${targetName === 'header' ? 'headers' : targetName === 'query' ? 'queries' : targetName === 'param' ? 'parameters' : targetName}!`;

    }

  }

  /** Transforms the target using the given transformer. */
  private async __transformObject(
    target: any,
    transformer: PipeFunction|AsyncPipeFunction|TransformationDefinition|BodyTransformationDefinition|ExecutablePipes,
    recurseMax: number = Infinity,
    recurseCount: number = 0,
    rawValues?: any
  ): Promise<any> {

    // Execute transformer into a function
    if ( this.__isExecutable<ExecutablePipes>(transformer) ) transformer = transformer.__exec();

    // PipeFunction (sync and async)
    if ( typeof transformer === 'function' ) {

      return await transformer(target, rawValues);

    }
    // Definition object
    else {

      // If recursing not allowed
      if ( recurseCount === recurseMax ) return undefined;

      // Expecting target to be an object
      if ( ! target || typeof target !== 'object' || target.constructor !== Object ) {

        return undefined;

      }

      for ( const key in transformer ) {

        target[key] = await this.__transformObject(target[key], transformer[key], recurseMax, recurseCount + 1, target);

      }

      return target;

    }

  }

  /** Executes transformation rule. */
  private async __aggregateTransformation(origins: OriginValues, req: Request, rule: TransformationRule) {

    if ( rule.target === AggregationTarget.Headers ) {

      // Reset to original if asked
      if ( rule.transformer === 'origin' ) {

        req.headers = _.cloneDeep(origins.headers);
        return;

      }

      // Can recurse once
      req.headers = await this.__transformObject(req.headers, rule.transformer, 1);

    }
    else if ( rule.target === AggregationTarget.Queries ) {

      // Reset to original if asked
      if ( rule.transformer === 'origin' ) {

        req.query = _.cloneDeep(origins.queries);
        return;

      }

      // Can recurse once
      req.query = await this.__transformObject(req.query, rule.transformer, 1);

    }
    else if ( rule.target === AggregationTarget.Body ) {

      // Reset to original if asked
      if ( rule.transformer === 'origin' ) {

        req.body = _.cloneDeep(origins.body);
        return;

      }

      // Can recurse inifinite times
      req.body = await this.__transformObject(req.body, rule.transformer);

    }
    else if ( rule.target === AggregationTarget.Params ) {

      // Reset to original if asked
      if ( rule.transformer === 'origin' ) {

        req.params = _.cloneDeep(origins.params);
        return;

      }

      // Can recurse once
      req.params = await this.__transformObject(req.params, rule.transformer, 1);

    }
    else if ( rule.target === AggregationTarget.Custom ) {

      // Send the whole request object to transformer and don't expect a return value
      if ( typeof rule.transformer === 'function' ) {

        await rule.transformer(req);

      }
      else {

        log.warn(`Custom transformer for route "${this.__getLogPath(req)}" is not a function!`);
        throw new Error('Invalid custom transformer!');

      }

    }
    else {

      log.warn(`Invalid transformation target "${rule.target}" for route "${this.__getLogPath(req)}"!`);
      throw new Error('An internal error has occurred!');

    }

  }

  /** Validates the target using the given validator. */
  private async __validateObject(
    target: any,
    targetName: 'header'|'query'|'body'|'param',
    validator: ValidatorFunction|AsyncValidatorFunction|ValidationDefinition|BodyValidationDefinition|ExecutableValidators,
    recurseMax: number = Infinity,
    recurseCount: number = 0,
    rawValues?: any,
    valuePath: string[] = []
  ): Promise<void|Error> {

    // Execute validator into a function
    if ( this.__isExecutable<ExecutablePipes>(validator) ) validator = validator.__exec();

    // ValidatorFunction (sync and async)
    if ( typeof validator === 'function' ) {

      const result = await validator(target, rawValues);

      if ( ! result ) {

        return new Error(this.__generateValidationErrorMessage(targetName, valuePath));

      }
      else if ( result instanceof Error ) {

        return result;

      }

    }
    // Definition object
    else {

      // If recursing not allowed
      if ( recurseCount === recurseMax ) return;

      // Expecting target to be an object
      if ( ! target || typeof target !== 'object' || target.constructor !== Object ) {

        return new Error(`${this.__generateValidationErrorMessage(targetName, valuePath)} Value must be an object.`);

      }

      for ( const key in validator ) {

        const result = await this.__validateObject(target[key], targetName, validator[key], recurseMax, recurseCount + 1, target, valuePath.concat([key]));

        if ( result instanceof Error ) return result;

      }

    }

  }

  /** Executes validation rule. */
  private async __aggregateValidation(req: Request, rule: ValidationRule): Promise<void|Error> {

    if ( rule.target === AggregationTarget.Headers ) {

      // Can recurse once
      return await this.__validateObject(req.headers, 'header', rule.validator, 1);

    }
    else if ( rule.target === AggregationTarget.Queries ) {

      // Can recurse once
      return await this.__validateObject(req.query, 'query', rule.validator, 1);

    }
    else if ( rule.target === AggregationTarget.Body ) {

      // Can recurse infinite times
      return await this.__validateObject(req.body, 'body', rule.validator);

    }
    else if ( rule.target === AggregationTarget.Params ) {

      // Can recurse once
      return await this.__validateObject(req.params, 'param', rule.validator, 1);

    }
    else if ( rule.target === AggregationTarget.Custom ) {

      // Send the whole request object to validator
      if ( typeof rule.validator === 'function' ) {

        const result = await rule.validator(req);

        if ( ! result ) return new Error(`Validation failed!`);
        else if ( result instanceof Error ) return result;

      }
      else {

        log.warn(`Custom transformer for route "${this.__getLogPath(req)}" is not a function!`);
        throw new Error('Invalid custom transformer!');

      }

    }
    else {

      log.warn(`Invalid validation target "${rule.target}" for route "${this.__getLogPath(req)}"!`);
      throw new Error('An internal error has occurred!');

    }

  }

  /** Determines if a transformation rule is present in a route definition. */
  private __doesTransform(route: RouteDefinition): boolean {

    return !! route.aggregate.filter(rule => this.__isTransformationRule(rule)).length;

  }

  /** Executes aggregation rules of a route on a request. */
  private async __executeAggregation(route: RouteDefinition, req: Request): Promise<AggregationResult> {

    const jsonBody = !! req.body && typeof req.body === 'object' && req.body.constructor === Object;
    const textBody = typeof req.body === 'string';
    let origins: OriginValues = null;

    // If aggregation rules do include transformation, copy req values as origins
    if ( this.__doesTransform(route) ) {

      origins = {
        headers: _.cloneDeep(req.headers),
        queries: _.cloneDeep(req.query),
        body: jsonBody ? _.cloneDeep(req.body) : (textBody ? req.body : null),
        params: _.cloneDeep(req.params)
      };

    }

    for ( const rule of route.aggregate ) {

      // If validation rule
      if ( this.__isValidationRule(rule) ) {

        // Skip if body is not JSON or text
        if ( rule.target === AggregationTarget.Body && ! jsonBody && ! textBody ) continue;

        const result = await this.__aggregateValidation(req, rule);

        if ( result instanceof Error ) return { reject: true, reason: result, code: 'VALIDATION_FAILED' };

      }
      // If transformation rule
      else if ( this.__isTransformationRule(rule) ) {

        // Skip if body is not transformable
        if ( rule.target === AggregationTarget.Body && ! jsonBody && ! textBody ) continue;

        await this.__aggregateTransformation(origins, req, rule);

      }
      // Invalid rule
      else {

        log.warn(`Invalid aggregation rule for route "${this.__getLogPath(req)}"!`);
        throw new Error('An internal error has occurred!');

      }

    }

    return { reject: false };

  }

  /** Returns a request handler which executes route aggregation rules and handles the request in case of an error. */
  private __getAggregationMiddleware(route: RouteDefinition): RequestHandler {

    return (req: Request, res: Response, next: NextFunction) => {

      this.__executeAggregation(route, req)
      .then(result => result.reject ? new ServerError(result.reason.message, 400, result.code).respond(res, req) : next())
      .catch(error => ServerError.from(error, 500).respond(res, req));

    };

  }

  /** Installs all routers, predictive 404 middleware (if allowed), 404 middleware, and error handler middleware. */
  private __installRouters() {

    let predictive404Installed: boolean = false;

    // Install routes
    for ( const router of this.__routers ) {

      // Install predictive 404 handler
      if ( this.__config.predictive404 && this.__config.predictive404Priority > router.module.__metadata.priority && ! predictive404Installed ) {

        predictive404Installed = true;

        this.__mountPredictive404();

        log.debug('Predictive 404 middleware installed');

      }

      // Check router
      if ( ! router.module.__metadata.routes || ! router.module.__metadata.routes.length ) {

        log.warn(`Router "${router.name}" has no defined routes!`);
        continue;

      }

      for ( const route of router.module.__metadata.routes ) {

        // Validate route definition
        if ( ! route || ! route.path || ! route.middleware || ! route.middleware.length ) {

          log.warn(`Router "${router.name}" has incorrectly defined a route!`);
          continue;

        }

        // Create route handlers
        const handlers: RequestHandler[] = [];

        // Create route logger
        handlers.push((req: Request, res, next) => {

          // Log headers and path
          if ( this.__config.logRequestHeaders ) {

            const url = this.__getLogPath(req, true);

            (req.session ? log.id(req.session.id) : log).debug(url.headers);
            (req.session ? log.id(req.session.id) : log).debug(req.method.toUpperCase(), url.path);

          }
          // Log path
          else {

            (req.session ? log.id(req.session.id) : log).debug(req.method.toUpperCase(), this.__getLogPath(req));

          }

          next();

        });

        // Create route validator if necessary
        if ( route.aggregate ) handlers.push(this.__getAggregationMiddleware(route));

        // Add CORS handler
        if ( this.__config.enableCors ) {

          const policy = route.corsPolicy || router.module.__metadata.corsPolicy || { origin: true };

          handlers.push(cors({
            origin: policy.origin,
            methods: policy.methods,
            allowedHeaders: policy.allowedHeaders,
            exposedHeaders: policy.exposedHeaders,
            credentials: policy.credentials,
            maxAge: policy.maxAge,
            optionsSuccessStatus: policy.optionsSuccessStatus
          }));

        }

        // Mount route middleware provided by user
        for ( const handler of route.middleware ) {

          // Validate middleware
          if ( ! Object.getOwnPropertyNames(Object.getPrototypeOf(router.module)).includes(handler) || typeof router.module[handler] !== 'function' ) {

            log.error(`Route handler "${handler}" not found in router "${router.name}"!`);
            continue;

          }

          // Wrap the middleware with an error handler if middleware is async
          if ( router.module[handler].constructor.name === 'AsyncFunction' ) {

            handlers.push((req: Request, res: Response, next: NextFunction) => {

              router.module[handler].bind(router.module)(req, res)
              .then(next)
              .catch((error: Error) => {

                if ( error instanceof ServerError ) {

                  if ( ! res.headersSent ) error.respond(res, req);

                }
                else {

                  (req.session ? log.id(req.session.id) : log).error('An error has occured:', error);

                  if ( ! res.headersSent ) new ServerError('An unknown error has occured!').respond(res, req);

                }

                events.emit('error', error);

              });

            });

          }
          else {

            handlers.push(router.module[handler].bind(router.module));

          }

        }

        // Install the route
        this.__app[route.method || 'use'](route.path, ...handlers);

        log.debug(`Route "${(route.method ? route.method.toUpperCase() : 'GLOBAL') + ' ' + route.path}" from router "${router.name}" was installed`);

      }

    }

    // Install predictive 404 (if not already)
    if ( this.__config.predictive404 && ! predictive404Installed ) {

      predictive404Installed = true;

      this.__mountPredictive404();

      log.debug('Predictive 404 middleware installed');

    }

    // Install 404 router
    if ( ! this.__config.predictive404 ) {

      this.__app.use('*', (req: Request, res) => {

        new ServerError(`Route ${this.__getLogPath(req)} not found!`, 404, 'ROUTE_NOT_FOUND').respond(res, req);

      });

      log.debug('404 middleware installed');

    }

    // Install error handler
    this.__app.use((error: Error, req: Request, res: Response, next: NextFunction) => {

      (req.session ? log.id(req.session.id) : log).error('An error has occured:', error);
      events.emit('error', error);

      if ( ! res.headersSent ) new ServerError('An unknown error has occured!').respond(res, req);

    });

    log.debug('Error handler middleware installed');

  }

  /** Initializes all components through hooks and emits related server events. */
  private async __initializeComponents(components: SingularComponent[]) {

    // Localize services for all service injections (converts services to a key-value pair object)
    const serviceServices = _.reduce(this.__services, (map, service) => {

      map[service.name] = service.module;

      return map;

    }, {});
    // Localize services for all router injections (converts services to a key-value pair object)
    const routerServices = _.reduce(this.__services, (map, service) => {

      map[service.name] = service.module;

      return map;

    }, {});
    // Localize config for all service injections
    const serviceConfig = _.cloneDeep(this.__config);
    // Localize config for all router injections
    const routerConfig = _.cloneDeep(this.__config);

    for ( const component of components ) {

      const moduleType = component.module.__metadata.type === ModuleType.Service ? 'service' : component.module.__metadata.type === ModuleType.Router ? 'router' : 'unknown';

      if ( moduleType === 'unknown' ) continue;

      if ( component.module.onInjection && typeof component.module.onInjection === 'function' ) {

        events.emitOnce(`${moduleType}:inject:before`, moduleType === 'service' ? serviceServices : routerServices);

        // Localize component-specific services
        const componentServices = _.clone(moduleType === 'service' ? serviceServices : routerServices);

        events.emitOnce(`${component.name}-${moduleType}:inject:before`, componentServices);

        await component.module.onInjection(componentServices);

        events.emitOnce(`${component.name}-${moduleType}:inject:after`, componentServices);
        events.emitOnce(`${moduleType}:inject:after`);

        log.debug(`Services injected into ${moduleType} "${component.name}"`);

      }

      if ( component.module.onConfig && typeof component.module.onConfig === 'function' ) {

        events.emitOnce(`${moduleType}:config:before`, moduleType === 'service' ? serviceConfig : routerConfig);

        // Localize component-specific config
        const componentConfig = _.cloneDeep(moduleType === 'service' ? serviceConfig : routerConfig);

        events.emitOnce(`${component.name}-${moduleType}:config:before`, componentConfig);

        await component.module.onConfig(componentConfig);

        events.emitOnce(`${component.name}-${moduleType}:config:after`, componentConfig);
        events.emitOnce(`${moduleType}:config:after`);

        log.debug(`Config injected into ${moduleType} "${component.name}"`);

      }

      if ( component.module.onInit && typeof component.module.onInit === 'function' ) {

        events.emitOnce(`${moduleType}:init:before`);
        events.emitOnce(`${component.name}-${moduleType}:init:before`);

        await component.module.onInit();

        events.emitOnce(`${component.name}-${moduleType}:init:after`);
        events.emitOnce(`${moduleType}:init:after`);

        log.debug(`${_.startCase(moduleType)} "${component.name}" was initialized`);

      }

    }

  }

  /** Scans the root directory and installs all components. */
  private __installComponents() {

    this.__scanDirRec(__rootdir)
    .filter(file => !! path.basename(file).match(/^(.+)\.((service)|(router))\.js$/))
    .forEach(file => this.__installComponent(file));

    // Sort components based on priority
    this.__routers = _.orderBy(this.__routers, router => router.module.__metadata.priority, ['desc']);
    this.__services = _.orderBy(this.__services, service => service.module.__metadata.priority, ['desc']);

    return this;

  }

  /** Instantiates all plugins. */
  private __initPlugins() {

    for ( let i = 0; i < this.__plugins.length; i++ ) {

      const plugin = this.__plugins[i];

      try {

        plugin.module = new plugin.pluginConstructor(plugin.config);

        if ( ! plugin.module.__metadata ) throw new Error(`Plugin is not decorated!`);

        this.__cachedLogs.push({
          level: 'debug',
          message: `Plugin "${plugin.module.__metadata.name}" was installed`
        });

      }
      catch (error) {

        this.__plugins.splice(i, 1);
        i--;

        this.__cachedLogs.push({
          level: 'error',
          message: `Plugin "${plugin.module?.__metadata?.name}" failed to install: ${error}`
        });

      }

    }

  }

  /** Updates the plugin data and runs plugin hooks. */
  private async __runPluginHook(hook: string) {

    // Update plugin data
    if ( hook === 'beforeConfig' ) this.__pluginData = {
      app: this.__app,
      rootdir: __rootdir,
      profiles: _.cloneDeep(this.__configProfiles)
    };
    if ( hook === 'afterConfig' ) this.__pluginData.config = _.cloneDeep(this.__config);
    if ( hook === 'beforeInternalMiddleware' ) this.__pluginData.components = {
      routers: this.__routers.map(r => ({
        metadata: r.module.__metadata,
        onInit: r.module.onInit,
        onInjection: r.module.onInjection,
        onConfig: r.module.onConfig
      })),
      services: this.__services.map(s => ({
        metadata: s.module.__metadata,
        onInit: s.module.onInit,
        onInjection: s.module.onInjection,
        onConfig: s.module.onConfig
      }))
    };

    // Run hooks
    for ( const plugin of this.__plugins ) {

      // If hook not implemented
      if ( ! plugin.module[hook] ) continue;

      // If invalid hook
      if ( typeof plugin.module[hook] !== 'function' ) {

        const message = `Invalid hook "${hook}" on plugin "${plugin.module.__metadata.name}"!`;

        if ( log ) log.warn(message);
        else this.__cachedLogs.push({
          level: 'warn',
          message
        });

        continue;

      }

      // Run hook
      try {

        const pluginLogger = new PluginLogger(this.__cachedLogs, plugin.module.__metadata.name);

        await plugin.module[hook](pluginLogger, this.__pluginData);

      }
      catch (error) {

        const message = `Hook "${hook}" of plugin "${plugin.module.__metadata.name}" threw error: ${error}`;

        if ( log ) log.error(message);
        else this.__cachedLogs.push({
          level: 'error',
          message
        });

      }

    }

  }

  /** Installs a Singular plugin with the provided plugin config. */
  public install(plugin: PluginConstructor, config?: any) {

    this.__plugins.push({ pluginConstructor: plugin, config, module: null });

    return this;

  }

  /** Registers all path aliases. */
  public registerAliases(paths: PathAliases) {

    tsConfigPaths.register({
      baseUrl: path.dirname(callsites()[1].getFileName()),
      paths
    });

    return this;

  }

  /** Registers a config profile. */
  public config(profile: string, config: ServerConfig) {

    this.__configProfiles[profile] = _.assign({}, Singular.__CONFIG_DEFAULT, config);

    return this;

  }

  /**
  * Loads and launches the server.
  * @param configProfile A config profile name to use instead of the default server config (defaults to SINGULAR_CONFIG_PROFILE environment variable).
  */
  public async launch(configProfile: string = process.env.SINGULAR_CONFIG_PROFILE) {

    // Get main file's directory path
    (<any>global).__rootdir = path.dirname(callsites()[1].getFileName());

    // Initialize all plugins
    this.__initPlugins();

    // Emit plugin event
    await this.__runPluginHook('beforeConfig');

    // If config profile not provided or not found
    if ( ! configProfile || ! this.__configProfiles.hasOwnProperty(configProfile) ) {

      this.__config = _.cloneDeep(Singular.__CONFIG_DEFAULT);

      // Warn user if config profile was provided but not found
      if ( configProfile && ! this.__configProfiles.hasOwnProperty(configProfile) ) {

        this.__cachedLogs.push({
          level: 'warn',
          message: `Config profile "${configProfile}" was not found! Default server config is used.`
        });

      }

    }
    // If provided and found
    else {

      this.__config = _.cloneDeep(this.__configProfiles[configProfile]);

    }

    // Sanitize the resolved config
    this.__sanitizeConfig(this.__config);

    // Initialize globals
    this.__initGlobals();

    // Log all cached logs
    for ( const cached of this.__cachedLogs ) {

      log[cached.level](cached.message);

    }

    // Clear cached logs
    this.__cachedLogs = [];

    // Emit plugin event
    await this.__runPluginHook('afterConfig');

    // Scan and install all components
    this.__installComponents();

    // Emit plugin event
    await this.__runPluginHook('beforeInternalMiddleware');

    // Mount default top middleware
    this.__mountDefaultTopMiddleware();

    // Emit plugin event
    await this.__runPluginHook('afterInternalMiddleware');
    await this.__runPluginHook('beforeUserMiddleware');

    // Install routers
    this.__installRouters();

    // Emit plugin event
    await this.__runPluginHook('afterUserMiddleware');

    // Disable default Express header
    this.__app.disable('x-powered-by');

    // Initialize all components
    try {

      await this.__initializeComponents(this.__services);
      await this.__initializeComponents(this.__routers);

    }
    catch (error) {

      log.error('Could not initialize components due to an error:', error);
      events.emit('error', error);

    }

    // Emit plugin event
    await this.__runPluginHook('beforeLaunch');

    // Start the server on HTTPS
    if ( this.__config.https ) {

      https.createServer({
        key: await fs.readFile(path.isAbsolute(this.__config.httpsKey) ? this.__config.httpsKey : path.resolve(__rootdir, this.__config.httpsKey)),
        cert: await fs.readFile(path.isAbsolute(this.__config.httpsCert) ? this.__config.httpsCert : path.resolve(__rootdir, this.__config.httpsCert))
      }, this.__app)
      .listen(this.__config.httpsPort, () => {

        log.notice(`HTTPS server started on port ${this.__config.httpsPort}`);
        // Emit plugin event
        this.__runPluginHook('afterLaunch');
        // Emit server event
        events.emit('launch', this.__config.httpsPort, 'https');

      })
      .on('error', (error: Error) => {

        log.error('Could not start the HTTPS server due to an error:', error);
        events.emit('error', error);

      });

      // Avoid starting HTTP server
      if ( this.__config.httpsOnly ) return;

    }

    // Start the server on HTTP
    http.createServer(this.__app)
    .listen(this.__config.port, () => {

      log.notice(`Server started on port ${this.__config.port}`);
      // Emit plugin event
      this.__runPluginHook('afterLaunch');
      // Emit server event
      events.emit('launch', this.__config.port, 'http');

    })
    .on('error', (error: Error) => {

      log.error('Could not start the server due to an error:', error);
      events.emit('error', error);

    });

  }

}

interface CompleteWithHooks extends BasicModule {

  onInjection?(services: any): void|Promise<void>;
  onConfig?(config: ServerConfig): void|Promise<void>;
  onInit?(): void|Promise<void>;

}

interface SingularComponent {

  name: string;
  module: CompleteWithHooks;

}

interface AggregationResult {

  reject: boolean;
  reason?: Error;
  code?: string;

}

interface OriginValues {

  headers: any;
  queries: any;
  body: any;
  params: any;

}

interface PathAliases {

  [alias: string]: string[];

}

export interface CachedLog {

  level: 'debug'|'info'|'notice'|'warn'|'error';
  message: string;
  additionalMessages?: string[];

}

interface ConfigProfiles {

  [name: string]: ServerConfig;

}

interface InstalledPlugin {

  pluginConstructor: PluginConstructor;
  module: PluginModule;
  config: any;

}

interface PluginModule {

  __metadata: { name: string; };
  beforeConfig?(log: PluginLogger, data: PluginDataBeforeConfig): void|Promise<void>;
  afterConfig?(log: PluginLogger, data: PluginDataAfterConfig): void|Promise<void>;
  beforeInternalMiddleware?(log: PluginLogger, data: PluginDataBeforeInternalMiddleware): void|Promise<void>;
  afterInternalMiddleware?(log: PluginLogger, data: PluginDataAfterInternalMiddleware): void|Promise<void>;
  beforeUserMiddleware?(log: PluginLogger, data: PluginDataBeforeUserMiddleware): void|Promise<void>;
  afterUserMiddleware?(log: PluginLogger, data: PluginDataAfterUserMiddleware): void|Promise<void>;
  beforeLaunch?(log: PluginLogger, data: PluginDataBeforeLaunch): void|Promise<void>;
  afterLaunch?(log: PluginLogger, data: PluginDataAfterLaunch): void|Promise<void>;

}

type PluginConstructor = new (config: any) => any;

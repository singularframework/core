import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
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
import { ServerError } from './error';
import { RequestHandler } from 'express';
import callsites from 'callsites';
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
  ExecutableValidators
} from '@singular/common';

export class Singular {

  /** Server config defaults. */
  private static __CONFIG_DEFAULT: ServerConfig = {
    port: 5000,
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

  /** Initializes all globals (config must be loaded before calling this method). */
  private __initGlobals() {

    (<any>global).events = new ServerEventManager();
    (<any>global).ServerError = ServerError;
    (<any>global).log = new ServerLogger(new ServerLoggerCore(this.__config));
    (<any>global).session = new ServerSessionManagerInternal(!! this.__config.sessionManagement, !! this.__config.cookieSecret);

    // Set error response logs
    (<any>global).ServerError.__logResponseErrors = this.__config.logResponseErrors;

  }

  /** Sanitizes the config object (must be run right after config is loaded). */
  private __sanitizeConfig(config: ServerConfig) {

    config.excludeHeadersInLogs = config.excludeHeadersInLogs.map(h => h.toLowerCase());
    config.excludeHeadersInLogs.push('authorization'); // Hide authorization header by default
    config.excludeQueryParamsInLogs = config.excludeQueryParamsInLogs.map(q => q.toLowerCase());

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

    // Install body parsers
    this.__app.use(bodyParser.text());
    this.__app.use(bodyParser.json());
    this.__app.use(bodyParser.raw({ limit: this.__config.fileUploadLimit }));
    this.__app.use(bodyParser.urlencoded({ extended: true }));

    // Install body parsing error
    this.__app.use((error, req, res, next) => {

      new ServerError('Invalid body!', 400, 'INVALID_BODY').respond(res);

    });

    log.debug('Body parser middleware have been installed');

    // Install cookie parser
    this.__app.use(cookieParser(this.__config.cookieSecret));

    // Install cookie parser error handler
    this.__app.use((error, req, res, next) => {

      new ServerError('Invalid cookies!', 400, 'INVALID_COOKIES').respond(res);

    });

    log.debug('Cookie parser middleware has been installed');

    // Install session manager middleware
    if ( this.__config.sessionManagement ) {

      this.__app.use((<ServerSessionManagerInternal>session).middleware);

      log.debug('Session manager middleware has been installed');

    }

  }

  /** Renders a request path for logging considering server config and allowed headers and queries in logs. */
  private __getLogPath(req: any) {

    // Parse URL
    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const result = {
      headers: undefined,
      path: undefined
    };

    // Hide params based on config
    for ( const param of url.searchParams.keys() ) {

      if ( this.__config.excludeQueryParamsInLogs.includes(param.toLowerCase()) )
        url.searchParams.set(param, 'HIDDEN');

    }

    result.path = url.toString();

    // Log headers
    if ( this.__config.logRequestHeaders ) {

      // Hide headers based on config
      const headers = _.clone(req.headers);

      for ( const header of this.__config.excludeHeadersInLogs ) {

        if ( headers.hasOwnProperty(header) ) headers[header] = 'HIDDEN';

      }

      // Log headers
      let headersLog = 'HEADERS';

      for ( const header in headers ) {

        headersLog += `\n${header} ${headers[header]}`;

      }

      result.headers = headersLog;

    }

    return result;

  }

  /** Mounts the predictive 404 middleware. */
  private __mountPredictive404() {

    this.__app.use('*', (req, res, next) => {

      let matches: number = 0;

      this.__app._router.stack.map(layer => {

        if ( layer.regexp.fast_star || layer.regexp.fast_slash ) return;

        if ( layer.match(req.originalUrl) ) matches++;

      });

      if ( matches ) next();
      else new ServerError(`Route ${this.__getLogPath(req).path} not found!`, 404, 'ROUTE_NOT_FOUND').respond(res);

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

  /** Transforms the target using the given transformer. */
  private async __transformObject(
    target: any,
    targetName: 'header'|'query'|'body',
    transformer: PipeFunction|AsyncPipeFunction|TransformationDefinition|BodyTransformationDefinition|ExecutablePipes,
    req: Request,
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

        target[key] = await this.__transformObject(target[key], targetName, transformer[key], req, recurseMax, ++recurseCount, target);

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
      req.headers = await this.__transformObject(req.headers, 'header', rule.transformer, req, 1);

    }
    else if ( rule.target === AggregationTarget.Queries ) {

      // Reset to original if asked
      if ( rule.transformer === 'origin' ) {

        req.query = _.cloneDeep(origins.queries);
        return;

      }

      // Can recurse once
      req.query = await this.__transformObject(req.query, 'query', rule.transformer, req, 1);

    }
    else if ( rule.target === AggregationTarget.Body ) {

      // Reset to original if asked
      if ( rule.transformer === 'origin' ) {

        req.body = _.cloneDeep(origins.body);
        return;

      }

      // Can recurse inifinite times
      req.body = await this.__transformObject(req.body, 'body', rule.transformer, req);

    }
    else if ( rule.target === AggregationTarget.Custom ) {

      // Send the whole request object to transformer and don't expect a return value
      if ( typeof rule.transformer === 'function' ) {

        await rule.transformer(req);

      }
      else {

        log.warn(`Custom transformer for route "${this.__getLogPath(req).path}" is not a function!`);
        throw new Error('Invalid custom transformer!');

      }

    }
    else {

      log.warn(`Invalid aggregation target "${rule.target}" for route "${this.__getLogPath(req).path}"!`);
      throw new Error('An internal error has occurred!');

    }

  }

  private async __validateObject(
    target: any,
    targetName: 'header'|'query'|'body',
    validator: ValidatorFunction|AsyncValidatorFunction|ValidationDefinition|BodyValidationDefinition|ExecutableValidators,
    req: Request,
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

        return new Error(`Invalid value for ${targetName === 'body' ? targetName + ' property' : targetName} "${valuePath.join('.')}"!`);

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

        return new Error(`Invalid value for ${targetName === 'body' ? targetName + ' property' : targetName} "${valuePath.join('.')}"! Value must be an object.`);

      }

      for ( const key in validator ) {

        const result = await this.__validateObject(target[key], targetName, validator[key], req, recurseMax, ++recurseCount, target, valuePath.concat([key]));

        if ( result instanceof Error ) return result;

      }

    }

  }

  /** Executes validation rule. */
  private async __aggregateValidation(req: Request, rule: ValidationRule): Promise<void|Error> {

    if ( rule.target === AggregationTarget.Headers ) {

      // Can recurse once
      return await this.__validateObject(req.headers, 'header', rule.validator, req, 1);

    }
    else if ( rule.target === AggregationTarget.Queries ) {

      // Can recurse once
      return await this.__validateObject(req.query, 'query', rule.validator, req, 1);

    }
    else if ( rule.target === AggregationTarget.Body ) {

      // Can recurse infinite times
      return await this.__validateObject(req.body, 'body', rule.validator, req);

    }
    else if ( rule.target === AggregationTarget.Custom ) {

      // Send the whole request object to validator
      if ( typeof rule.validator === 'function' ) {

        await rule.validator(req);

      }
      else {

        log.warn(`Custom transformer for route "${this.__getLogPath(req).path}" is not a function!`);
        throw new Error('Invalid custom transformer!');

      }

    }
    else {

      log.warn(`Invalid aggregation target "${rule.target}" for route "${this.__getLogPath(req).path}"!`);
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

    // If aggregation rules does include transformation, copy req values as origins
    if ( this.__doesTransform(route) ) {

      origins = {
        headers: _.cloneDeep(req.headers),
        queries: _.cloneDeep(req.query),
        body: jsonBody ? _.cloneDeep(req.body) : (textBody ? req.body : null)
      };

    }

    for ( const rule of route.aggregate ) {

      // If validation rule
      if ( this.__isValidationRule(rule) ) {

        // Skip if body is not JSON or text
        if ( rule.target === AggregationTarget.Body && (! jsonBody || ! textBody) ) continue;

        const result = await this.__aggregateValidation(req, rule);

        if ( result instanceof Error ) return { reject: true, reason: result, code: 'VALIDATION_FAILED' };

      }
      // If transformation rule
      else if ( this.__isTransformationRule(rule) ) {

        // Skip if body is not transformable
        if ( rule.target === AggregationTarget.Body && (! jsonBody || ! textBody) ) continue;

        await this.__aggregateTransformation(origins, req, rule);

      }
      // Invalid rule
      else {

        log.warn(`Invalid aggregation rule for route "${this.__getLogPath(req).path}"!`);
        throw new Error('An internal error has occurred!');

      }

    }

    return { reject: false };

  }

  /** Returns a request handler which executes route aggregation rules and handles the request in case of an error. */
  private __getAggregationMiddleware(route: RouteDefinition): RequestHandler {

    return (req: Request, res: Response, next: NextFunction) => {

      this.__executeAggregation(route, req)
      .then(result => result.reject ? new ServerError(result.reason.message, 400, result.code).respond(res) : next())
      .catch(error => ServerError.from(error, 500).respond(res));

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

        for ( const handler of route.middleware ) {

          if ( ! Object.getOwnPropertyNames(Object.getPrototypeOf(router)).includes(handler) || typeof router[handler] !== 'function' ) {

            log.error(`Route handler "${handler}" not found in router "${router.name}"!`);
            continue;

          }

        }

        // Create route handlers
        const handlers: RequestHandler[] = [];

        // Create route logger
        handlers.push((req, res, next) => {

          const url = this.__getLogPath(req);

          if ( this.__config.logRequestHeaders ) log.debug(url.headers);

          log.debug(req.method.toUpperCase(), url.path);

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

          handlers.push(router[handler].bind(router));

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

      this.__app.use('*', (req, res) => {

        new ServerError(`Route ${this.__getLogPath(req).path} not found!`, 404, 'ROUTE_NOT_FOUND').respond(res);

      });

      log.debug('404 middleware installed');

    }

    // Install error handler
    this.__app.use((error, req, res, next) => {

      log.error('An unknown error has occured:', error);
      events.emit('error', error);

      if ( ! res.headerSent ) new ServerError('An unknown error has occured!').respond(res);

    });

    log.debug('Error handler middleware installed');

  }

  /** Initializes all components through hooks and emits related server events. */
  private async __initializeComponents(components: SingularComponent[]) {

    for ( const component of components ) {

      const moduleType = component.module.__metadata.type === ModuleType.Service ? 'service' : 'router';

      if ( component.module.onInjection && typeof component.module.onInjection === 'function' ) {

        // Convert services to a key-value pair object
        const componentServices = _.reduce(this.__services, (map, service) => {

          map[service.name] = service;

          return map;

        }, {});

        events.emitOnce(`${moduleType}:inject:before`, componentServices);
        events.emitOnce(`${component.name}-${moduleType}:inject:before`, componentServices);

        await component.module.onInjection(componentServices);

        events.emitOnce(`${component.name}-${moduleType}:inject:after`, componentServices);
        events.emitOnce(`${moduleType}:inject:after`);

        log.debug(`Services injected into ${moduleType} "${component.name}"`);

      }

      if ( component.module.onConfig && typeof component.module.onConfig === 'function' ) {

        const componentConfig = _.cloneDeep(this.__config);

        events.emitOnce(`${moduleType}:config:before`, componentConfig);
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

  /** Scans the root directory (where this method is called from) and installs all components. */
  public installComponents() {

    this.__scanDirRec(path.dirname(callsites()[1].getFileName()))
    .filter(file => !! path.basename(file).match(/^(.+)\.((service)|(router))\.js$/))
    .forEach(file => this.__installComponent(file));

    // Sort components based on priority
    this.__routers = _.orderBy(this.__routers, router => router.module.__metadata.priority, ['desc']);
    this.__services = _.orderBy(this.__services, service => service.module.__metadata.priority, ['desc']);

    return this;

  }

  /**
  * Loads and launches the server.
  * @param configProfile A config profile name to use instead of the default server config (defaults to SINGULAR_CONFIG_PROFILE environment variable).
  */
  public async launch(configProfile: string = process.env.SINGULAR_CONFIG_PROFILE) {

    // Get main file's directory path
    (<any>global).__rootdir = path.dirname(callsites()[1].getFileName());

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

    // Mount default top middleware
    this.__mountDefaultTopMiddleware();

    // Install routers
    this.__installRouters();

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

    // Start the server
    this.__app.listen(this.__config.port, (error: Error) => {

      if ( error ) {

        log.error('Could not start the server due to an error:', error);
        events.emit('error', error);

      }
      else {

        log.notice(`Server started on port ${this.__config.port}`);
        events.emit('launch', this.__config.port);

      }

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

}

interface PathAliases {

  [alias: string]: string[];

}

interface CachedLog {

  level: 'debug'|'info'|'notice'|'warn'|'error';
  message: string;
  additionalMessages?: string[];

}

interface ConfigProfiles {

  [name: string]: ServerConfig;

}

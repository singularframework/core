import {
  Singular,
  BodyTransformationDefinition,
  BodyValidationDefinition,
  RouteDefinition,
  AggregationTarget
} from '../../dist/core';
import { ServerEventManager } from '../../dist/events';
import { LoggerDecoy, RequestDecoy } from './decoys';
import { expect } from 'chai';
import stripAnsi from 'strip-ansi';
import { wait } from './util';

describe('Singular', function() {

  it('should render request path and headers for logs correctly', function () {

    (<any>Singular).__config = {
      excludeQueryParamsInLogs: ['token'],
      excludeHeadersInLogs: ['authorization', 'host']
    };

    const req = new RequestDecoy();

    req.protocol = 'http';
    req.headers = {
      authorization: 'Basic **********',
      host: 'localhost:5000',
      'content-type': 'application/json'
    };
    req.originalUrl = '/test?token=my_token&page=3';

    expect(stripAnsi((<any>Singular).__getLogPath(req))).to.equal('http://localhost:5000/test?token=HIDDEN&page=3');
    expect((<any>Singular).__getLogPath(req, true).headers).to.be.undefined;

    (<any>Singular).__config.logRequestHeaders = true;

    const rendered = (<any>Singular).__getLogPath(req, true);

    expect(stripAnsi(rendered.headers).match(/HEADERS\n/)).not.to.be.null;
    expect(stripAnsi(rendered.headers).match(/authorization: HIDDEN/)).not.to.be.null;
    expect(stripAnsi(rendered.headers).match(/host: HIDDEN/)).not.to.be.null;
    expect(stripAnsi(rendered.headers).match(/content-type: application\/json/)).not.to.be.null;

  });

  it('should transform objects correctly', async function() {

    // Flat target
    let def: BodyTransformationDefinition = {
      firstName: value => value.toLowerCase(),
      lastName: { __exec: () => async value => value.toLowerCase().trim() }
    };
    let target: any = {
      firstName: 'David',
      lastName: ' Blame '
    };

    target = await (<any>Singular).__transformObject(target, def, 1);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame'
    });

    // Nested target
    def = {
      firstName: value => value.toLowerCase(),
      lastName: async value => value.toLowerCase().trim(),
      is: {
        absolutely: {
          what: value => value.trim(),
          // Virtual property
          insane: () => true
        }
      }
    };
    target = {
      firstName: 'David',
      lastName: ' Blame ',
      is: {
        absolutely: {
          what: ' crazy '
        }
      }
    };

    target = await (<any>Singular).__transformObject(target, def);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame',
      is: {
        absolutely: {
          what: 'crazy',
          insane: true
        }
      }
    });

    // Object def on non-object value and recursion limitation
    def = {
      magician: value => ! value,
      location: {
        city: value => value
      },
      nested: {
        object: {
          name: value => value
        }
      }
    };
    target = {
      magician: false,
      location: 'Los Angeles',
      nested: {
        object: {
          name: 'Object'
        }
      }
    };

    target = await (<any>Singular).__transformObject(target, def, 2);

    expect(target).to.deep.equal({
      magician: true,
      location: undefined,
      nested: {
        object: undefined
      }
    });

    // Direct transformer function
    target = {
      firstName: 'David',
      lastName: ' Blame '
    };

    target = await (<any>Singular).__transformObject(target, value => ({
      firstName: value.firstName.toLowerCase().trim(),
      lastName: value.lastName.toLowerCase().trim()
    }) ,1);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame'
    });

    // Direct executable pipes
    target = {
      firstName: 'David',
      lastName: ' Blame '
    };

    target = await (<any>Singular).__transformObject(target, { __exec: () => async value => ({
      firstName: value.firstName.toLowerCase().trim(),
      lastName: value.lastName.toLowerCase().trim()
    }) } ,1);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame'
    });

  });

  it('should validate objects correctly', async function() {

    // Flat object
    let target: any = {
      firstName: 'david',
      lastName: 'blame'
    };
    let def: BodyValidationDefinition = {
      firstName: async value => typeof value === 'string',
      lastName: { __exec: () => async (value, rawValues) => rawValues.firstName === 'david' }
    };

    let result = await (<any>Singular).__validateObject(target, 'body', def, 1);

    expect(result).to.be.undefined;

    target.firstName = true;

    result = await (<any>Singular).__validateObject(target, 'body', def, 1);

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Invalid value for body property "firstName"!');

    // Nested object
    target = {
      magician: true,
      is: {
        absolutely: {
          crazy: true
        }
      }
    };
    def = {
      magician: value => typeof value === 'boolean',
      is: {
        absolutely: {
          crazy: value => typeof value === 'boolean'
        }
      }
    };

    result = await (<any>Singular).__validateObject(target, 'body', def);

    expect(result).to.be.undefined;

    // Object def on non-object value
    def = {
      magician: {
        successful: async value => typeof value === 'boolean'
      }
    };

    result = await (<any>Singular).__validateObject(target, 'body', def);

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Invalid value for body property "magician"! Value must be an object.');

    // Recursion limitation
    target = {
      topLevel: true,
      nested: {
        value: false
      }
    };
    def = {
      topLevel: value => typeof value === 'boolean',
      nested: {
        value: value => value !== false
      }
    };

    result = await (<any>Singular).__validateObject(target, 'body', def, 1);

    expect(result).to.be.undefined;

    // Direct validator function and custom error message
    result = await (<any>Singular).__validateObject(target, 'body', value => value.topLevel ? new Error('Custom message!') : true, 1);

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Custom message!');

    // Direct executable validators
    result = await (<any>Singular).__validateObject(target, 'header', { __exec: () => async value => !! value.nested.value });

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Invalid value in headers!');

  });

  it('should execute aggregation rules correctly', async function() {

    const route: RouteDefinition = {
      path: '/test',
      middleware: [''],
      aggregate: [
        {
          target: AggregationTarget.Headers,
          transformer: {
            'content-type': value => value.toLowerCase()
          }
        },
        {
          target: AggregationTarget.Queries,
          transformer: {
            page: value => +value
          }
        },
        {
          target: AggregationTarget.Custom,
          transformer: req => req.body.customRan = true
        },
        {
          target: AggregationTarget.Body,
          transformer: {
            fullName: (value, rawValues) => `${rawValues.firstName} ${rawValues.lastName}`
          }
        }
      ]
    };

    const req = new RequestDecoy();

    req.headers = {
      'content-type': 'APPLICATION/Json',
      'host': 'localhost:5000'
    };
    req.query = {
      page: '3'
    };
    req.body = {
      firstName: 'Randy',
      lastName: 'Blythe'
    };
    req.protocol = 'http';
    req.originalUrl = '/test';

    (<any>Singular).__config = {};

    // Test transformations
    let result = await (<any>Singular).__executeAggregation(route, req);

    expect(result.reject).to.be.false;
    expect(req.headers['content-type']).to.equal('application/json');
    expect(req.query.page).to.equal(3);
    expect(req.body).to.deep.equal({
      firstName: 'Randy',
      lastName: 'Blythe',
      fullName: 'Randy Blythe',
      customRan: true
    });

    route.aggregate.push({
      target: AggregationTarget.Body,
      transformer: 'origin'
    });

    // Test origin transformation
    result = await (<any>Singular).__executeAggregation(route, req);

    expect(result.reject).to.be.false;
    expect(req.body).to.deep.equal(req.body);

    // Test validators
    route.aggregate.push({
      target: AggregationTarget.Headers,
      validator: {
        'content-type': value => value === 'application/json'
      }
    }, {
      target: AggregationTarget.Queries,
      validator: {
        limit: async (value, rawValues) => {

          return (value === undefined && rawValues.page !== undefined) || (value !== undefined && rawValues.page === undefined);

        }
      }
    }, {
      target: AggregationTarget.Body,
      validator: { __exec: () => async value => !! value.customRan || new Error('Custom transformer not ran!') }
    }, {
      target: AggregationTarget.Custom,
      validator: req => ! req.body.fail
    });

    req.query.limit = 100;

    result = await (<any>Singular).__executeAggregation(route, req);

    expect(result.reject).to.be.true;
    expect(result.reason.message).to.equal('Invalid value for query "limit"!');
    expect(result.code).to.equal('VALIDATION_FAILED');

    req.query.limit = undefined;
    req.body.customRan = false;

    result = await (<any>Singular).__executeAggregation(route, req);

    expect(result.reject).to.be.true;
    expect(result.reason.message).to.equal('Custom transformer not ran!');
    expect(result.code).to.equal('VALIDATION_FAILED');

    req.body.customRan = true;

    result = await (<any>Singular).__executeAggregation(route, req);

    expect(result.reject).to.be.false;

    req.body.fail = true;

    result = await (<any>Singular).__executeAggregation(route, req);

    expect(result.reject).to.be.true;
    expect(result.reason.message).to.equal('Validation failed!');
    expect(result.code).to.equal('VALIDATION_FAILED');

    req.body.fail = false;

    // Test invalid validation rule
    (<any>route.aggregate).push({
      target: 'blah',
      validator: value => !! value
    });

    const loggerDecoy = new LoggerDecoy();
    (<any>global).log = loggerDecoy;

    let errorThrown = false;

    try {

      result = await (<any>Singular).__executeAggregation(route, req);

    }
    catch(error) {

      errorThrown = true;
      expect(error.message).to.equal('An internal error has occurred!');
      expect(loggerDecoy.history).to.deep.equal([
        {
          type: 'function',
          name: 'warn',
          args: ['Invalid validation target "blah" for route "http://localhost:5000/test"!']
        }
      ]);

    }

    expect(errorThrown).to.be.true;

    route.aggregate.pop();
    loggerDecoy.clearHistory();

    // Test invalid transformation rule
    (<any>route.aggregate).push({
      target: 'blah',
      transformer: value => !! value
    });

    errorThrown = false;

    try {

      result = await (<any>Singular).__executeAggregation(route, req);

    }
    catch(error) {

      errorThrown = true;
      expect(error.message).to.equal('An internal error has occurred!');
      expect(loggerDecoy.history).to.deep.equal([
        {
          type: 'function',
          name: 'warn',
          args: ['Invalid transformation target "blah" for route "http://localhost:5000/test"!']
        }
      ]);

    }

    expect(errorThrown).to.be.true;

    route.aggregate.pop();
    loggerDecoy.clearHistory();

    // Test invalid aggregation rule
    (<any>route.aggregate).push({
      target: AggregationTarget.Body,
      blah: value => !! value
    });

    errorThrown = false;

    try {

      result = await (<any>Singular).__executeAggregation(route, req);

    }
    catch(error) {

      errorThrown = true;
      expect(error.message).to.equal('An internal error has occurred!');
      expect(loggerDecoy.history).to.deep.equal([
        {
          type: 'function',
          name: 'warn',
          args: ['Invalid aggregation rule for route "http://localhost:5000/test"!']
        }
      ]);

    }

    expect(errorThrown).to.be.true;

    route.aggregate.pop();
    loggerDecoy.clearHistory();

  });

  it('should scan root directory for components and initialize them correctly', async function() {

    // Set test timeout
    this.timeout(10000);

    const eventData = [];

    // Inject global event manager
    (<any>global).events = new ServerEventManager();

    // Inject global logger decoy
    (<any>global).log = new LoggerDecoy();

    // Attach event listeners
    events.on('test:component:router:init', name => {

      eventData.push({
        event: 'test:component:router:init',
        name,
        args: []
      });

    });
    events.on('test:component:router:config', (name, config) => {

      eventData.push({
        event: 'test:component:router:config',
        name,
        args: [config]
      });

    });
    events.on('test:component:router:inject', (name, services) => {

      eventData.push({
        event: 'test:component:router:inject',
        name,
        args: [services]
      });

    });
    events.on('test:component:service:init', name => {

      eventData.push({
        event: 'test:component:service:init',
        name,
        args: []
      });

    });
    events.on('test:component:service:config', (name, config) => {

      eventData.push({
        event: 'test:component:service:config',
        name,
        args: [config]
      });

    });
    events.on('test:component:service:inject', (name, services) => {

      eventData.push({
        event: 'test:component:service:inject',
        name,
        args: [services]
      });

    });

    // Manipulate config for specific component
    events.on('test2-service:config:before', config => {

      config.manipulated = true;

    });

    // Manipulate service for specific component
    events.on('test-router:inject:before', services => {

      services.virtual = true;

    });

    // Manipulate services for all components
    events.on('service:inject:before', services => {

      services.virtual = null;

    });
    events.on('router:inject:before', services => {

      services.virtual = null;

    });

    // Manipulate config for all components
    events.on('service:config:before', config => {

      config.virtual = true;

    });
    events.on('router:config:before', config => {

      config.virtual = true;

    });

    // Set config
    (<any>Singular).__config = {
      injectedConfig: true
    };

    // Scan and install components
    (<any>Singular).__installComponents();

    // Initialize all components
    await (<any>Singular).__initializeComponents((<any>Singular).__services);
    await (<any>Singular).__initializeComponents((<any>Singular).__routers);

    // Give events time to emit
    await wait(1000);

    // Check emitted events total
    expect(eventData.length).to.equal(9);
    // Check emitted events order
    expect(eventData.map(e => e.event)).to.deep.equal([
      'test:component:service:inject',
      'test:component:service:config',
      'test:component:service:init',
      'test:component:service:inject',
      'test:component:service:config',
      'test:component:service:init',
      'test:component:router:inject',
      'test:component:router:config',
      'test:component:router:init'
    ]);
    // Check emitted events arguments
    expect(eventData
      .filter(e => e.event.substr(-7) === ':config' && e.name !== 'test2')
      .map(e => e.args)
    ).to.deep.equal([
      [{ injectedConfig: true, virtual: true }],
      [{ injectedConfig: true, virtual: true }]
    ]);

    expect(
      eventData
      .filter(e => e.event.substr(-7) === ':config' && e.name === 'test2')
      .map(e => e.args)
    ).to.deep.equal([
      [{ injectedConfig: true, virtual: true, manipulated: true }]
    ]);

    const mappedServices: any = {
      virtual: null
    };

    for ( const service of (<any>Singular).__services ) {

      mappedServices[service.name] = service;

    }

    expect(eventData
      .filter(e => e.event.substr(-7) === ':inject')
      .map(e => e.args)
    ).to.deep.equal([
      [mappedServices],
      [mappedServices],
      [{ ...mappedServices, virtual: true }]
    ]);

  });

});

import { ModuleType, RouteMethod } from '@singular/common';
import { Service, Router, Interceptor, Plugin } from '../../dist/decorators';
import { expect } from 'chai';

describe('Decorators', function() {

  it('should correctly provide metadata on decorated service classes', function() {

    @Service({
      name: 'test'
    })
    class TestService {}

    const testService = new TestService();

    expect((<any>testService).__metadata).to.deep.equal({
      name: 'test',
      type: ModuleType.Service,
      priority: 0
    });

    @Service({
      name: 'test',
      priority: Infinity
    })
    class PrioritizedTestService {}

    const prioritizedTestService = new PrioritizedTestService();

    expect((<any>prioritizedTestService).__metadata).to.deep.equal({
      name: 'test',
      type: ModuleType.Service,
      priority: Infinity
    });

  });

  it('should correctly provide metadata on decorated router classes', function() {

    @Router({
      name: 'test',
      routes: [
        { path: '/', method: RouteMethod.GET, middleware: ['m1'] }
      ],
      priority: 2,
      corsPolicy: {
        origin: true
      }
    })
    class TestRouter {}

    const testRouter = new TestRouter();

    expect((<any>testRouter).__metadata).to.deep.equal({
      name: 'test',
      type: ModuleType.Router,
      priority: 2,
      corsPolicy: { origin: true },
      routes: [{ path: '/', method: RouteMethod.GET, middleware: ['m1'] }]
    });

  });

  it('should correctly provide metadata on decorated interceptor classes', function() {

    @Interceptor({
      name: 'test'
    })
    class TestInterceptor {}

    const testInterceptor = new TestInterceptor();

    expect((<any>testInterceptor).__metadata).to.deep.equal({
      name: 'test',
      type: ModuleType.Interceptor,
      priority: 0,
      intercepts: 'all'
    });

    @Interceptor({
      name: 'test',
      priority: Infinity,
      intercepts: [
        '/auth/**'
      ]
    })
    class PrioritizedTestInterceptor {}

    const prioritizedTestInterceptor = new PrioritizedTestInterceptor();

    expect((<any>prioritizedTestInterceptor).__metadata).to.deep.equal({
      name: 'test',
      type: ModuleType.Interceptor,
      priority: Infinity,
      intercepts: [
        '/auth/**'
      ]
    });

  });

  it('should correctly provide metadata on decorated plugin classes', function() {

    @Plugin({
      name: 'test'
    })
    class TestPlugin {}

    const testPlugin = new TestPlugin();

    expect((<any>testPlugin).__metadata).to.deep.equal({
      name: 'test',
      type: ModuleType.Plugin
    });

  });

});

import { Interceptor, OnInit, OnConfig, OnInjection, OnInterception } from '../../../dist/core';
import { config as componentConfig } from '@app/config';

@Interceptor({
  name: 'test',
  intercepts: [
    '/auth/**'
  ]
})
export class TestInterceptor implements OnInit, OnConfig, OnInjection, OnInterception {

  public config = componentConfig;

  onInit() {

    events.emit('test:component:interceptor:init', 'test');

  }

  onInjection(services: any) {

    events.emit('test:component:interceptor:inject', 'test', services);

  }

  onConfig(config: any) {

    events.emit('test:component:interceptor:config', 'test', config);

  }

  onInterception() {}

}

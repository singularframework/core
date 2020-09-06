import { Service, OnInit, OnConfig, OnInjection } from '../../../dist/core';

@Service({
  name: 'test1'
})
export class TestService1 implements OnInit, OnConfig, OnInjection {

  onInit() {

    events.emit('test:component:service:init', 'test1');

  }

  onInjection(services: any) {

    events.emit('test:component:service:inject', 'test1', services);

  }

  onConfig(config: any) {

    events.emit('test:component:service:config', 'test1', config);

  }

}

@Service({
  name: 'test2'
})
export class TestService2 implements OnInit, OnConfig, OnInjection {

  onInit() {

    events.emit('test:component:service:init', 'test2');

  }

  onInjection(services: any) {

    events.emit('test:component:service:inject', 'test2', services);

  }

  onConfig(config: any) {

    events.emit('test:component:service:config', 'test2', config);

  }

}

import { Router, OnInit, OnConfig, OnInjection } from '../../../dist/core';

@Router({
  name: 'test',
  routes: []
})
export class TestRouter implements OnInit, OnConfig, OnInjection {

  onInit() {

    events.emit('test:component:router:init', 'test');

  }

  onInjection(services: any) {

    events.emit('test:component:router:inject', 'test', services);

  }

  onConfig(config: any) {

    events.emit('test:component:router:config', 'test', config);

  }

}

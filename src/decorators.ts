import { ModuleType, PluginDecoratorArgs, ServiceDecoratorArgs, RouterDecoratorArgs } from '@singular/common';

export function Service(config: ServiceDecoratorArgs) {

  return (target: any) => {

    target.prototype.__metadata = {
      name: config.name,
      priority: config.priority || 0,
      type: ModuleType.Service
    };

  };

}

export function Router(config: RouterDecoratorArgs) {

  return (target: any) => {

    target.prototype.__metadata = {
      name: config.name,
      type: ModuleType.Router,
      routes: config.routes,
      priority: config.priority || 0,
      corsPolicy: config.corsPolicy
    };

  };

}

export function Plugin(config: PluginDecoratorArgs) {

  return (target: any) => {

    target.prototype.__metadata = {
      name: config.name,
      type: ModuleType.Plugin
    };

  };

}

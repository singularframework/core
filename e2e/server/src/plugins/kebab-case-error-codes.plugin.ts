import { Plugin, PluginHooks, PluginLogger } from '../../../../dist/core';

@Plugin({
  name: 'kebab-case-error-codes'
})
export class KebabCaseErrorCodesPlugin implements PluginHooks.AfterConfig {

  afterConfig(log: PluginLogger) {

    class KebabCaseServerError extends ServerError {

      constructor(message: string, statusCode: number = 500, code: string = 'unknown-error') {

        super(message, statusCode, code.replace(/_/g, '-').toLowerCase());

      }

      static from(error: Error, statusCode?: number, code?: string) {

        const serverError = new KebabCaseServerError(error.message, statusCode || 500, code || (<any>error).code);

        serverError.stack = error.stack;

        return serverError;

      }

    }

    (<any>global).ServerError = KebabCaseServerError;

    log.debug('Patched ServerError global');

  }

}

import { Plugin, PluginHooks, PluginLogger } from '../../../../dist/core';

@Plugin({
  name: 'kebab-case-error-codes'
})
export class KebabCaseErrorCodesPlugin implements PluginHooks.AfterConfig {

  afterConfig(log: PluginLogger) {

    class KebabCaseServerError extends ServerError {

      constructor(message: string, httpCode: number = 500, code: string = 'unknown-error') {

        super(message, httpCode, code.replace(/_/g, '-').toLowerCase());

      }

      static from(error: Error, httpCode?: number, code?: string) {

        const serverError = super.from(error, httpCode, code);

        serverError.code = serverError.code.replace(/_/g, '-').toLowerCase();

        return serverError;

      }

    }

    (<any>global).ServerError = KebabCaseServerError;

    log.debug('Patched ServerError global');

  }

}

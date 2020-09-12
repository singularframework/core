import { Interceptor, OnInterception } from '@singular/core';

@Interceptor({
  name: 'error-code'
})
export class ErrorCodeInterceptor implements OnInterception {

  onInterception(body: any) {

    if ( body.error === true ) body.code = body.code.replace(/\-/g, '_').toUpperCase();

    return body;

  }

}

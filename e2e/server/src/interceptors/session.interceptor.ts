import { Interceptor, OnInterception, Request } from '@singular/core';
import { ProtectedRequest } from '@pit/middleware/token-protected';
import { SignupRequest } from '@pit/router/auth';

@Interceptor({
  name: 'session'
})
export class SessionInterceptor implements OnInterception {

  isSignupRequest(req: any): req is SignupRequest {

    return !! req.body && typeof req.body === 'object' && req.body.constructor === Object && 'username' in req.body;

  }

  isProtectedRequest(req: any): req is ProtectedRequest {

    return !! req.user && typeof req.user === 'object' && req.user.constructor === Object && 'username' in req.user;

  }

  async onInterception(body: any, req: Request|SignupRequest|ProtectedRequest) {

    // Write session claims
    if ( req?.session.isNew ) {

      // Write username claim
      let username: string;

      if ( this.isSignupRequest(req) && ! body.error ) username = req.body.username;
      else if ( this.isProtectedRequest(req) ) username = req.user.username;

      if ( username ) await session.setClaim(req.session.id, 'username', username);

      // Write user-agent claim
      await session.setClaim(req.session.id, 'user-agent', req.get('user-agent'));
      await session.setClaim(req.session.id, 'ip', req.ip);

    }
    else if ( this.isSignupRequest(req) && ! body.error ) {

      await session.setClaim(req.session.id, 'username', req.body.username);

    }

    return body;

  }

}

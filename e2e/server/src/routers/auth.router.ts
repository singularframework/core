import { Router, route, OnInjection, OnConfig, Request, Response, NextFunction, validate, transform, ServerConfig } from '@singular/core';
import { pipe } from '@singular/pipes';
import { should, could, it } from '@singular/validators';
import { UsersService } from '@pit/service/users';
import { corsPolicy } from '@pit/cors/global';

@Router({
  name: 'auth',
  priority: 100,
  routes: [
    route.post('/auth/signup', 'signup', [
      validate.headers({
        'content-type': should.equal('application/json')
      }),
      validate.body({
        username: pipe.trim.lowercase.then(
          should.be.a.string.that.matches(/^[a-z0-9]+$/i).with.length.between(8, 32)
          .otherwise('Username should be alphanumeric only and 8 to 32 characters long!'),
        ),
        password: should.have.these.allTrue(
          should.be.a.string.otherwise('Password must be a string!'),
          should.have.length.between(8, 64).otherwise('Password must be 8 to 64 characters long!'),
          should.match(/[a-z]+/).otherwise('Password should include at least one lowercase character!'),
          should.match(/[A-Z]+/).otherwise('Password should include at least one uppercase character!'),
          should.match(/\d+/).otherwise('Password should include at least one number!'),
          should.match(/[@#$%^!&*()\-_+=`~.,?/\\<>:;'"\[\]{}|]+/).otherwise('Password should include at least one special character!')
        ),
        manager: could.be.a.boolean
      }),
      transform.body({
        username: pipe.trim.lowercase,
        manager: pipe.set(false).when(it.is.undefined)
      }),
      validate.body({
        username: should.have.these.allTrue(UsersService.usernameAvailable).otherwise('Username is taken!')
      })
    ]),
    route.get('/auth/login', ['basicAuth', 'login'], [
      validate.headers({
        'authorization': should.match(/^Basic .+$/)
      })
    ])
  ],
  corsPolicy
})
export class AuthRouter implements OnInjection, OnConfig {

  private users: UsersService;
  private config: ServerConfig;

  onInjection({ users }) {

    this.users = users;

  }

  onConfig(config: ServerConfig) {

    this.config = config;

  }

  async signup(req: SignupRequest, res: Response) {

    const uid = await this.users.createUser(req.body.username, req.body.password, req.body.manager);

    res.respond({ uid });

  }

  basicAuth(req: BasicAuthRequest, res: Response, next: NextFunction) {

    const encoded = req.get('authorization').match(/^Basic (?<encoded>.+)$/).groups.encoded;
    const decoded = Buffer.from(encoded, 'base64').toString();

    req.auth = {
      username: decoded.split(':')[0],
      password: decoded.split(':')[1]
    };

    next();

  }

  async login(req: BasicAuthRequest, res: Response) {

    const token = await this.users.authenticateUser(req.auth.username, req.auth.password);

    // If logged in with existing session ID
    if ( ! req?.session.isNew ) {

      // Read username assigned to current session ID
      const username: string = await session.getClaim(req.session.id, 'username');

      // If username claim exists with different value
      if ( username !== req.auth.username ) {

        // Generate new session ID
        const newSessionId = session.generateId();

        // Reset cookie
        res.clearCookie('sessionId');
        res.cookie('sessionId', newSessionId, { signed: !! this.config.cookieSecret });

        // Map old session ID to the new one
        await session.setClaim(req.session.id, 'mapped', newSessionId);

      }

    }

    res.respond({ token });

  }

}

export interface SignupRequest extends Request {

  body: {
    username: string;
    password: string;
    manager?: boolean;
  };

}

export interface BasicAuthRequest extends Request {

  auth: {
    username: string;
    password: string;
  };

}

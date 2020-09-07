import { Router, route, OnInjection, Request, Response, validate, transform } from '@singular/core';
import { pipe } from '@singular/pipes';
import { should, could, it } from '@singular/validators';
import { UsersService } from '@pit/service/users';

@Router({
  name: 'auth',
  routes: [
    route.post('/auth/signup', 'signup', [
      validate.headers({
        'content-type': should.equal('application/json')
      }),
      validate.body({
        username: pipe.trim.lowercase.then(
          should.be.a.string.that.matches(/^[a-z0-9]+$/i).with.length.between(8, 32)
          .otherwise('Username should be alphanumeric only and 8 to 32 characters long!')
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
      })
    ])
  ]
})
export class AuthRouter implements OnInjection {

  private users: UsersService;

  onInjection({ users }) {

    this.users = users;

  }

  signup(req: SignupRequest, res: Response) {

    

  }

}

export interface SignupRequest extends Request {

  body: {
    username: string;
    password: string;
    manager?: boolean;
  };

}

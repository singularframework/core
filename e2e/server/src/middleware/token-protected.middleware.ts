import { Request, Response, NextFunction } from '@singular/core';
import { UsersService, TokenData } from '@pit/service/users';
import { User } from '@pit/model/user';

export function tokenProtected(router: RouterWithUsersService) {

  return (req: ProtectedRequest, res: Response, next: NextFunction) => {

    router.users.decryptToken(req.query.token)
    .then(data => {

      req.tokenData = data;

      return router.users.getUser(data.uid);

    })
    .then(user => {

      req.user = user;
      next();

    })
    .catch(error => ServerError.from(error, 400).respond(res));

  };

}

export interface ProtectedRequest extends Request {

  query: {
    token: string;
  },
  tokenData: TokenData;
  user: User;

}

interface RouterWithUsersService {

  users: UsersService;

}

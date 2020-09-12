import { Request, Response, NextFunction } from '@singular/core';
import { UsersService, TokenData } from '@pit/service/users';
import { User } from '@pit/model/user';

export function tokenProtected(router: RouterWithUsersService) {

  return async (req: ProtectedRequest, res: Response, next: NextFunction) => {

    req.tokenData = await router.users.decryptToken(req.query.token);
    req.user = await router.users.getUser(req.tokenData.uid);

    next();

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

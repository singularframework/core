import { Request } from '@singular/core';
import { UsersService, TokenData } from '@pit/service/users';
import { User } from '@pit/model/user';

export function tokenProtected(router: RouterWithUsersService) {

  return async (req: ProtectedRequest) => {

    req.tokenData = await router.users.decryptToken(req.query.token);
    req.user = await router.users.getUser(req.tokenData.uid);

    if ( req?.session.isNew ) await session.setClaim(req.session.id, 'username', req.user.username);

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

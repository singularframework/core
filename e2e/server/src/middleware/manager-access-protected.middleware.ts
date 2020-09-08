import { ProtectedRequest } from './token-protected.middleware';
import { Response, NextFunction } from '@singular/core';

export function managerAccessProtected(req: ProtectedRequest, res: Response, next: NextFunction) {

  if ( ! req.user.manager )
    return new ServerError('Only managers can access this endpoint!', 401, 'ACCESS_DENIED').respond(res);

  next();

}

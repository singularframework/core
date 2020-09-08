import { validate } from '@singular/core';
import { should } from '@singular/validators';

export const jsonBodyValidator = validate.headers({ 'content-type': should.equal('application/json') });

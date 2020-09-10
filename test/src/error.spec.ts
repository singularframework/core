import { ServerError } from '../../dist/error';
import { RequestDecoy, ResponseDecoy, LoggerDecoy } from './decoys';
import { expect } from 'chai';

describe('ServerError', function() {

  it('should construct a correct server error object', function() {

    function toNormalObject(error: ServerError, withStack?: boolean) {

      const object: any = {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        error: error.error
      };

      if ( withStack ) object.stack = error.stack;

      return object;

    }

    expect(toNormalObject(new ServerError('Error message'))).to.deep.equal({
      message: 'Error message',
      statusCode: 500,
      code: 'UNKNOWN_ERROR',
      error: true
    });

    expect(toNormalObject(new ServerError('Error message', 400, 'TEST_ERROR'))).to.deep.equal({
      message: 'Error message',
      statusCode: 400,
      code: 'TEST_ERROR',
      error: true
    });

    const error1 = new Error('Native error');

    expect(toNormalObject(ServerError.from(error1), true)).to.deep.equal({
      message: 'Native error',
      statusCode: 500,
      code: 'UNKNOWN_ERROR',
      error: true,
      stack: error1.stack
    });

    const error2 = new Error('Native error');

    (<any>error2).code = 'SHOULD_BE_IGNORED';

    expect(toNormalObject(ServerError.from(error2, 404, 'NATIVE_ERROR'), true)).to.deep.equal({
      message: 'Native error',
      statusCode: 404,
      code: 'NATIVE_ERROR',
      error: true,
      stack: error2.stack
    });

    const error3 = new Error('Native error');

    (<any>error3).code = 'CUSTOM_CODE';

    expect(toNormalObject(ServerError.from(error3, 404), true)).to.deep.equal({
      message: 'Native error',
      statusCode: 404,
      code: 'CUSTOM_CODE',
      error: true,
      stack: error3.stack
    });

  });

  it('should respond to requests with errors correctly', function() {

    const req = new RequestDecoy();
    const res = new ResponseDecoy();
    const log = new LoggerDecoy();
    (<any>global).log = log.decoy;

    new ServerError('Error message').respond(res.decoy);

    expect(res.history).to.deep.equal([
      { type: 'function', name: 'status', args: [500] },
      { type: 'function', name: 'json', args: [{ error: true, message: 'Error message', code: 'UNKNOWN_ERROR' }] }
    ]);

    res.clearHistory();

    req.session.id = 'SESSION_ID';
    req.session.isNew = false;
    (<any>ServerError).__logResponseErrors = true;

    new ServerError('Error message!', 404, 'NOT_FOUND').respond(res.decoy, req.decoy);

    expect(res.history).to.deep.equal([
      { type: 'function', name: 'status', args: [404] },
      { type: 'function', name: 'json', args: [{ error: true, message: 'Error message!', code: 'NOT_FOUND' }] }
    ]);

    expect(log.history.length).to.equal(2);
    expect(log.history[0]).to.deep.equal({ type: 'function', name: 'id', args: ['SESSION_ID'] });
    expect(log.history[1].name).to.equal('debug');
    expect(log.history[1].args.length).to.equal(1);
    expect(log.history[1].args[0]).to.match(/status 404.+code "NOT_FOUND"/);

    log.clearHistory();

  });

});

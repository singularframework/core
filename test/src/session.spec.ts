import { ServerSessionManagerInternal } from '../../dist/session';
import { LoggerDecoy, RequestDecoy, ResponseDecoy, NextDecoy } from './decoys';
import { expect } from 'chai';

describe('ServerSessionManager', function() {

  it('should log warning messages and do nothing when session management is disabled or not integrated', async function() {

    const loggerDecoy = new LoggerDecoy();
    // Inject logger decoy globally
    (<any>global).log = loggerDecoy;

    // Test session management disabled messages
    let session = new ServerSessionManagerInternal(false, false);

    session.on('created', () => {});

    const setClaimResult = await session.setClaim('id', 'claim', 123);
    const getClaimResult = await session.getClaim('id', 'claim');

    expect(loggerDecoy.history.length).to.equal(3);
    expect(loggerDecoy.history.map(h => h.name).join(',')).to.equal('warn,warn,warn');
    expect(loggerDecoy.history.map(h => h.args.length)).to.deep.equal([1, 1, 1]);
    expect(loggerDecoy.history.map(h => !! h.args[0].match(/Session management is disabled!$/)).reduce((a, b) => a && b)).to.be.true;
    expect(setClaimResult).to.be.undefined;
    expect(getClaimResult).to.be.undefined;

    loggerDecoy.clearHistory();

    // Test session management not integrated
    session = new ServerSessionManagerInternal(true, false);

    session.on('created', () => {});
    const setClaimResult2 = await session.setClaim('id', 'claim', 123);
    const getClaimResult2 = await session.getClaim('id', 'claim');

    expect(loggerDecoy.history.length).to.equal(2);
    expect(loggerDecoy.history.map(h => h.name).join(',')).to.equal('warn,warn');
    expect(loggerDecoy.history.map(h => h.args.length)).to.deep.equal([1, 1]);
    expect(loggerDecoy.history.map(h => !! h.args[0].match(/Session event 'claim:((set)|(get))' has no handler assigned!$/)).reduce((a, b) => a && b)).to.be.true;
    expect(setClaimResult2).to.be.undefined;
    expect(getClaimResult2).to.be.undefined;

    loggerDecoy.clearHistory();

    // Test session management already integrated
    session.on('claim:get', () => {});
    session.on('claim:get', () => {});
    session.on('claim:set', () => {});
    session.on('claim:set', () => {});

    expect(loggerDecoy.history.length).to.equal(2);
    expect(loggerDecoy.history.map(h => h.name).join(',')).to.equal('error,error');
    expect(loggerDecoy.history.map(h => h.args.length)).to.deep.equal([1, 1]);
    expect(loggerDecoy.history.map(h => !! h.args[0].match(/Session's 'claim:((get)|(set))' event has already been assigned a handler!$/)).reduce((a, b) => a && b)).to.be.true;

    loggerDecoy.clearHistory();

    // Test invalid session management events
    (<any>session).on('blah', () => {});

    expect(loggerDecoy.history.length).to.equal(1);
    expect(loggerDecoy.history[0].name).to.equal('error');
    expect(loggerDecoy.history[0].args.length).to.equal(1);
    expect(loggerDecoy.history[0].args[0]).to.equal("Event 'blah' does not exist on session!");

    loggerDecoy.clearHistory();

  });

  it('should generate session ID and manage claims correctly', async function() {

    (<any>global).log = new LoggerDecoy();

    this.timeout(10000);

    let session = new ServerSessionManagerInternal(true, false);
    let claims: { [id: string]: { [name: string]: any } } = {};
    const req = new RequestDecoy();
    const res = new ResponseDecoy();
    const next = new NextDecoy();
    let middleware = session.middleware.bind(session);

    // Test middleware with no integration
    middleware(req.decoy, res.decoy, next.decoy);

    await next.then();
    next.reset();

    // Next should have been called
    expect(next.history).to.deep.equal([
      { type: 'function', name: 'next' }
    ]);

    // req.session must have been set
    expect(
      req.history
      .filter(h => h.name === 'session' && h.type === 'property-set')
      .length
    ).to.equal(1);
    expect(
      req.history
      .filter(h => h.name === 'session' && h.type === 'property-set')[0].value
    ).not.to.be.undefined;

    // Response cookie should have been set
    expect(res.history.length).to.equal(1);
    expect(res.history[0]).to.deep.equal({
      type: 'function',
      name: 'cookie',
      args: [
        'sessionId',
        req.history.filter(h => h.name === 'session' && h.type === 'property-set')[0].value.id,
        { signed: false }
      ]
    });

    next.clearHistory();
    req.clearHistory();
    res.clearHistory();

    // Test middleware with integration
    session.on('created', id => ! claims[id] ? claims[id] = <any>{} : undefined);
    session.on('claim:get', (id, key) => !! claims[id] ? claims[id][key] : undefined);
    session.on('claim:set', (id, key, value) => {

      if ( ! claims.hasOwnProperty(id) ) return;

      claims[id][key] = value;

    });

    middleware(req.decoy, res.decoy, next.decoy);

    await next.then();
    next.reset();

    const sessionId = req.history.filter(h => h.name === 'session' && h.type === 'property-set')[0].value.id;

    // Created handler should have worked
    expect(claims.hasOwnProperty(sessionId)).to.be.true;

    // Get claim should return undefined
    expect(await session.getClaim(sessionId, 'not-there')).to.be.undefined;

    // Set claim should work
    await session.setClaim(sessionId, 'name', 'John');

    expect(claims[sessionId].name).to.equal('John');

    next.clearHistory();
    req.clearHistory();
    res.clearHistory();

    // Test signed cookies and async handlers
    session = new ServerSessionManagerInternal(true, true);
    middleware = session.middleware.bind(session);
    claims = {
      'SESSION_ID': {}
    };

    session.on('claim:get', (id, key) => {

      return new Promise((resolve, reject) => {

        setTimeout(() => {

          if ( ! claims.hasOwnProperty(id) ) return reject(new Error('Id not found!'));

          resolve(claims[id][key]);

        }, 1000);

      });

    });
    session.on('claim:set', (id, key, value) => {

      return new Promise((resolve, reject) => {

        setTimeout(() => {

          if ( ! claims.hasOwnProperty(id) ) return reject(new Error('Id not found!'));

          claims[id][key] = value;
          resolve();

        }, 1000);

      });

    });

    req.signedCookies.sessionId = 'SESSION_ID';

    middleware(req.decoy, res.decoy, next.decoy);

    await next.then();
    next.reset();

    expect(req.session.id).to.equal('SESSION_ID');

    await session.setClaim('SESSION_ID', 'name', 'Mark');

    expect(await session.getClaim('SESSION_ID', 'name')).to.equal('Mark');

  });

});

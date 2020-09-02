import { ServerEventManager } from '../../dist/events';
import { LoggerDecoy } from './decoys';
import { expect } from 'chai';

describe('ServerEventManager', function() {

  const events = new ServerEventManager();
  let argsReceived = [];
  const handler1 = (arg1, arg2) => { argsReceived.push({ name: 'handler1', args: [arg1, arg2] }); };
  const handler2 = (...args) => { argsReceived.push({ name: 'handler2', args }); };

  it('should attach listeners correctly', function() {

    events.on('test', handler1);
    events.once('test', handler1);
    events.addListener('test', handler2);
    events.addOnceListener('test', handler1);
    events.prependListener('test', handler2);
    events.prependOnceListener('test', handler2);

    events.on('test2', handler2);
    events.once('test2', handler2);

    expect((<any>events).__events).to.deep.equal({
      test: {
        args: [],
        once: false,
        listeners: [
          { once: true, listener: handler2 },
          { once: false, listener: handler2 },
          { once: false, listener: handler1 },
          { once: true, listener: handler1 },
          { once: false, listener: handler2 },
          { once: true, listener: handler1 }
        ]
      },
      test2: {
        args: [],
        once: false,
        listeners: [
          { once: false, listener: handler2 },
          { once: true, listener: handler2 }
        ]
      }
    });

  });

  it('should remove listeners correctly', function() {

    events.off('test', handler1);
    events.removeListener('test', handler2);
    events.removeAllListeners('test2');

    expect((<any>events).__events).to.deep.equal({
      test: {
        args: [],
        once: false,
        listeners: [
          { once: false, listener: handler2 },
          { once: true, listener: handler1 },
          { once: false, listener: handler2 },
          { once: true, listener: handler1 }
        ]
      },
      test2: {
        args: [],
        once: false,
        listeners: []
      }
    });

  });

  it('should return listeners data correctly', function() {

    expect(events.listenersCount('test')).to.equal(4);
    expect(events.listenersCount('test2')).to.equal(0);
    expect(events.listenersCount('test1900')).to.equal(0);
    expect(events.getListeners('test')).to.deep.equal([
      handler2,
      handler1,
      handler2,
      handler1
    ]);
    expect(events.getRawListeners('test')).to.deep.equal([
      { once: false, listener: handler2 },
      { once: true, listener: handler1 },
      { once: false, listener: handler2 },
      { once: true, listener: handler1 }
    ]);
    expect(events.getListeners('test2').length).to.equal(0);
    expect(events.getRawListeners('test2').length).to.equal(0);
    expect(events.getListeners('test1900').length).to.equal(0);
    expect(events.getRawListeners('test1900').length).to.equal(0);

  });

  it('should emit events correctly', function(done) {

    events.emit('test', 1, 2, 3);

    expect(events.getRawListeners('test')).to.deep.equal([
      { once: false, listener: handler2 },
      { once: false, listener: handler2 }
    ]);

    expect(argsReceived).to.deep.equal([
      { name: 'handler2', args: [1,2,3] },
      { name: 'handler1', args: [1,2] },
      { name: 'handler2', args: [1,2,3] },
      { name: 'handler1', args: [1,2] }
    ]);

    argsReceived = [];

    events.emit('test', 1, 2, 3);

    expect(events.getRawListeners('test')).to.deep.equal([
      { once: false, listener: handler2 },
      { once: false, listener: handler2 }
    ]);

    expect(argsReceived).to.deep.equal([
      { name: 'handler2', args: [1,2,3] },
      { name: 'handler2', args: [1,2,3] }
    ]);

    argsReceived = [];

    events.emitOnce('test', 4, 5);

    // Listeners should be deleted after once emit
    expect(events.listenersCount('test')).to.equal(0);

    events.emit('test', 4, 5);
    events.emitOnce('test', 4, 5);

    // Listeners should have been run once
    expect(argsReceived).to.deep.equal([
      { name: 'handler2', args: [4, 5] },
      { name: 'handler2', args: [4, 5] }
    ]);

    argsReceived = [];

    events.on('test', (...args) => { argsReceived.push({ name: 'anon', args }); });

    // Listener should have been run immediately without being attached
    expect(argsReceived).to.deep.equal([
      { name: 'anon', args: [4, 5] }
    ]);
    expect(events.listenersCount('test')).to.equal(0);

    argsReceived = [];

    events.on('test2', () => {

      return new Promise(resolve => {

        setTimeout(() => {

          argsReceived.push({ name: 'async' });
          resolve();

        }, 100);

      });

    });

    events.emit('test2');

    setTimeout(() => {

      expect(argsReceived).to.deep.equal([{ name: 'async' }]);

      done();

    }, 500);

  });

  it('should handle errors thrown by listener correctly', function() {

    const log = new LoggerDecoy();
    (<any>global).log = log.decoy;

    events.on('test3', () => { throw new Error('Error thrown!'); })
    events.emit('test3');

    expect(log.history.length).to.equal(1);
    expect(log.history[0].name).to.equal('error');
    expect(log.history[0].args.length).to.equal(2);
    expect(log.history[0].args[0]).to.match(/on event "test3"/);
    expect(log.history[0].args[1]).to.have.property('message', 'Error thrown!');

    log.clearHistory();

  });

});

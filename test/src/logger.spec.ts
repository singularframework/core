import { ServerLoggerCore, ServerLogger } from '../../dist/logger';
import { Singular } from '../../dist/singular';
import { ConsoleDecoy } from './decoys';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs-extra';
import stripAnsi from 'strip-ansi';
import { wait } from './util';
import readline from 'readline';

describe('ServerLogger', function() {

  (<any>global).__rootdir = __dirname;

  it('should not log to file when configured correctly', async function() {

    const originalConsole = console;
    const consoleDecoy = new ConsoleDecoy();
    // Swap console with decoy
    (<any>global).console = consoleDecoy;

    const log = new ServerLogger(new ServerLoggerCore(Object.assign({}, (<any>Singular).__CONFIG_DEFAULT, {
      archiveLogs: false,
      writeLogsToFile: false,
      logFileDirPath: path.resolve(__dirname, '.logs')
    })));

    log.debug('Debug log');
    log.info('Info log');
    log.warn('Warning log');

    // Should have not logged to file
    expect(await fs.pathExists(path.resolve(__dirname, '.logs'))).to.be.false;
    // Should have logged in correct order
    expect(consoleDecoy.history.map(h => h.name)).to.deep.equal(['log', 'warn']);
    // Should have logged the correct messages
    expect(
      consoleDecoy.history
      .map(h => h.args.length === 1 && !! h.args[0].match(/(Info)|(Warning) log/))
      .reduce((a, b) => a && b)
    ).to.be.true;

    // Swap console back to original
    (<any>global).console = originalConsole;

  });

  it('should log to console correctly', function() {

    const originalConsole = console;
    const consoleDecoy = new ConsoleDecoy();
    // Swap console with decoy
    (<any>global).console = consoleDecoy;

    const log = new ServerLogger(new ServerLoggerCore(Object.assign({}, (<any>Singular).__CONFIG_DEFAULT, {
      archiveLogs: false,
      writeLogsToFile: false,
      logFileDirPath: path.resolve(__dirname, '.logs'),
      consoleLogLevels: ['debug', 'error', 'info', 'warn']
    })));

    let levels = ['debug', 'error', 'notice', 'info', 'warn'];
    let cursor = 0;

    for ( let i = 0; i < 200; i++ ) {

      log[levels[cursor]](`${levels[cursor]} log`);
      cursor++;

      if ( cursor === levels.length ) cursor = 0;

    }

    // Should have logged 160 messages (no notices)
    expect(consoleDecoy.history.length).to.equal(160);
    // Should have logged in correct order of levels
    expect(
      consoleDecoy.history.map(h => h.name).join(',')
    ).to.deep.equal(
      ['debug', 'error', 'log', 'warn'].join(',').repeat(40).replace(/warndebug/g, 'warn,debug')
    );
    // Should have logged correct number of messages in each log
    expect(
      consoleDecoy.history
      .map(h => h.args.length === 1)
      .reduce((a, b) => a && b)
    ).to.be.true;
    // Should have logged correct messages
    expect(
      consoleDecoy.history
      .map(h => stripAnsi(h.args[0]).match(/^\[.+\]\s+.+\s+(?<level>.+)\s+log$/).groups.level)
    ).to.deep.equal(
      ['debug', 'error', 'info', 'warn'].join(',').repeat(40).replace(/warndebug/g, 'warn,debug').split(',')
    );

    // Swap console back to original
    (<any>global).console = originalConsole;

  });

  it('should log to file correctly', async function() {

    this.timeout(10000);

    const log = new ServerLogger(new ServerLoggerCore(Object.assign({}, (<any>Singular).__CONFIG_DEFAULT, {
      archiveLogs: false,
      writeLogsToFile: true,
      logFileDirPath: './.logs',
      logFileMaxAge: 0,
      consoleLogLevels: []
    })));

    let levels = ['debug', 'error', 'notice', 'error', 'info', 'warn', 'warn'];
    let cursor = 0;

    for ( let i = 0; i < 10003; i++ ) {

      log[levels[cursor]](`Log #${i + 1}`);
      cursor++;

      if ( cursor === levels.length ) cursor = 0;

    }

    // Give the logs queue time to finish writing all logs
    await wait(3000);

    // There should be a file on disk with 10003 lines in correct order
    const logFiles = fs.readdirSync(path.resolve(__dirname, '.logs'));

    expect(logFiles.length).to.equal(1);

    const rl = readline.createInterface({
      input: fs.createReadStream(path.resolve(__dirname, '.logs', logFiles[0])),
      output: process.stdout,
      terminal: false
    });

    let logNumber = 1;

    await new Promise((resolve, reject) => {

      rl
      .on('line', line => expect(!! line.match(new RegExp(`^.+Log #${logNumber++}$`))).to.be.true)
      .on('close', resolve)
      .on('error', reject);

    });

    expect(logNumber).to.equal(10004);

  });

  it('should delete logs correctly', function() {



  });

  it('should archive logs correctly', function() {



  });

});

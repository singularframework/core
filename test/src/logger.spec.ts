import { ServerLoggerCore, ServerLogger } from '../../dist/logger';
import { Singular } from '../../dist/singular';
import { ConsoleDecoy } from './decoys';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs-extra';
import stripAnsi from 'strip-ansi';
import { wait } from './util';
import readline from 'readline';
import { DateTime } from 'luxon';
import zlib from 'zlib';

describe('ServerLogger', function() {

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

    // Clean up
    await fs.remove(path.resolve(__dirname, '.logs'));

  });

  it('should delete logs correctly based on max age', async function() {

    this.timeout(10000);

    // Patch setInterval to extract all timeouts
    const intervals: NodeJS.Timeout[] = [];
    const originalSetInterval = setInterval;

    (<any>global).setInterval = (cb, ms, ...args: any[]) => {

      const interval = originalSetInterval(cb, ms, ...args);

      intervals.push(interval);

      return interval;

    };

    // Create logger
    const log = new ServerLogger(new ServerLoggerCore(Object.assign({}, (<any>Singular).__CONFIG_DEFAULT, {
      archiveLogs: false,
      writeLogsToFile: true,
      logFileDirPath: './.logs',
      logFileMaxAge: 1, // One day max age for logs on disk
      consoleLogLevels: []
    })));

    log.info('This log should be deleted by the disk manager');

    // Give the logger time to create the file and write the log
    await wait(500);

    // Expect one file with the correct date as name to exist
    const filename = path.resolve(__dirname, '.logs', DateTime.local().toFormat('dd-LL-yyyy') + '.log');

    expect(await fs.pathExists(filename)).to.be.true;

    // Trick the disk management to think it's tomorrow
    const originalLocal = DateTime.local;

    DateTime.local = () => DateTime.fromMillis(Date.now() + (24 * 60 * 60 * 1000));

    // Give disk management time to detect and delete the logs
    await wait(1500);

    // Expect the file to be deleted
    expect(await fs.pathExists(filename)).to.be.false;

    // Unpatch DateTime
    DateTime.local = originalLocal;

    // Clear all intervals so the process can end
    for ( const interval of intervals ) {

      clearInterval(interval);

    }

    // Clean up
    await fs.remove(path.resolve(__dirname, '.logs'));

  });

  it('should archive logs correctly based on max age', async function() {

    this.timeout(10000);

    // Patch setInterval to extract all timeouts
    const intervals: NodeJS.Timeout[] = [];
    const originalSetInterval = setInterval;

    (<any>global).setInterval = (cb, ms, ...args: any[]) => {

      const interval = originalSetInterval(cb, ms, ...args);

      intervals.push(interval);

      return interval;

    };

    // Create logger
    const log = new ServerLogger(new ServerLoggerCore(Object.assign({}, (<any>Singular).__CONFIG_DEFAULT, {
      archiveLogs: true,
      writeLogsToFile: true,
      logFileDirPath: './.logs',
      logFileMaxAge: 1, // One day max age for logs on disk
      consoleLogLevels: []
    })));

    log.info('This log should be archived by the disk manager');

    // Give the logger time to create the file and write the log
    await wait(500);

    // Expect one file with the correct date as name to exist
    const filename = path.resolve(__dirname, '.logs', DateTime.local().toFormat('dd-LL-yyyy') + '.log');
    const archiveFilename = path.resolve(__dirname, '.logs', 'archived', DateTime.local().toFormat('dd-LL-yyyy') + '.log.gz');

    expect(await fs.pathExists(filename)).to.be.true;

    // Trick the disk management to think it's tomorrow
    const originalLocal = DateTime.local;

    DateTime.local = () => DateTime.fromMillis(Date.now() + (24 * 60 * 60 * 1000));

    // Give disk management time to detect and delete the logs
    await wait(1500);

    // Expect the file to be deleted in .logs directory
    expect(await fs.pathExists(filename)).to.be.false;

    // Expect the file to be archived
    expect(await fs.pathExists(archiveFilename)).to.be.true;

    // Unzip the file and check the logs inside
    let archivedLogs = '';

    await new Promise((resolve, reject) => {

      fs.createReadStream(archiveFilename)
      .pipe(zlib.createGunzip())
      .on('data', chunk => archivedLogs += chunk.toString())
      .on('close', resolve)
      .on('error', reject);

    });

    expect(archivedLogs.includes('This log should be archived by the disk manager')).to.be.true;

    // Unpatch DateTime
    DateTime.local = originalLocal;

    // Clear all intervals so the process can end
    for ( const interval of intervals ) {

      clearInterval(interval);

    }

    // Clean up
    await fs.remove(path.resolve(__dirname, '.logs'));

  });

  it('should write logs to custom path on disk correctly', async function() {

    this.timeout(10000);

    // Patch setInterval to extract all timeouts
    const intervals: NodeJS.Timeout[] = [];
    const originalSetInterval = setInterval;

    (<any>global).setInterval = (cb, ms, ...args: any[]) => {

      const interval = originalSetInterval(cb, ms, ...args);

      intervals.push(interval);

      return interval;

    };

    // Create logger
    const log = new ServerLogger(new ServerLoggerCore(Object.assign({}, (<any>Singular).__CONFIG_DEFAULT, {
      archiveLogs: true,
      writeLogsToFile: true,
      logFileDirPath: path.resolve(__dirname, 'customdir', 'logs'),
      logFileArchiveDirPath: './customdir/archived',
      logFileMaxAge: 1, // One day max age for logs on disk
      consoleLogLevels: []
    })));

    log.info('This log should be archived by the disk manager');

    // Give the logger time to create the file and write the log
    await wait(500);

    // Expect one file with the correct date as name to exist
    const filename = path.resolve(__dirname, 'customdir', 'logs', DateTime.local().toFormat('dd-LL-yyyy') + '.log');
    const archiveFilename = path.resolve(__dirname, 'customdir', 'archived', DateTime.local().toFormat('dd-LL-yyyy') + '.log.gz');

    expect(await fs.pathExists(filename)).to.be.true;

    // Trick the disk management to think it's tomorrow
    const originalLocal = DateTime.local;

    DateTime.local = () => DateTime.fromMillis(Date.now() + (24 * 60 * 60 * 1000));

    // Give disk management time to detect and delete the logs
    await wait(1500);

    // Expect the file to be deleted in customdir/logs directory
    expect(await fs.pathExists(filename)).to.be.false;

    // Expect the file to be archived
    expect(await fs.pathExists(archiveFilename)).to.be.true;

    // Unpatch DateTime
    DateTime.local = originalLocal;

    // Clear all intervals so the process can end
    for ( const interval of intervals ) {

      clearInterval(interval);

    }

    // Clean up
    await fs.remove(path.resolve(__dirname, 'customdir'));

  });

});

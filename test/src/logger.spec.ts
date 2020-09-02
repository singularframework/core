import { ServerLoggerCore, ServerLogger } from '../../dist/logger';
import { Singular } from '../../dist/singular';
import { ConsoleDecoy } from './decoys';
import { expect } from 'chai';
import path from 'path';
import fs from 'fs-extra';

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

  // it('should log to console correctly', function() {
  //
  // 
  //
  // });
  //
  // it('should log to file correctly', function() {
  //
  //
  //
  // });
  //
  // it('should archive logs correctly', function() {
  //
  //
  //
  // });

});

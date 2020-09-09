import got, { Got } from 'got';
import fs from 'fs-extra';
import path from 'path';

export default (it: Mocha.TestFunction) => {

  let request: Got;

  before(function() {

    request = got.extend({
      prefixUrl: process.env.SINGULAR_CONFIG_PROFILE === 'dev' ? 'http://localhost:5000' : 'https://localhost:5001',
      responseType: 'json'
    });

  });

  it('should create manager account successfully', async function() {



  });

  // Clean up
  after(function(done) {

    this.timeout(10000);

    setTimeout(async () => {

      await fs.remove(path.join(__dirname, '..', 'server', 'dist', '.logs'));
      await fs.ensureDir(path.join(__dirname, '..', 'server', 'dist', '.logs'));

      await fs.remove(path.join(__dirname, '..', 'server', 'dist', '.data'));
      await fs.ensureDir(path.join(__dirname, '..', 'server', 'dist', '.data'));

      done();

    }, 2000);

  });

};

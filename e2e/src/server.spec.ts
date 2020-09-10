import got, { Got } from 'got';
import fs from 'fs-extra';
import path from 'path';
import https from 'https';

export default (it: Mocha.TestFunction) => {

  let request: Got;

  before(async function() {

    request = got.extend({
      prefixUrl: process.env.SINGULAR_CONFIG_PROFILE === 'dev' ? 'http://localhost:5000' : 'https://localhost:5001',
      responseType: 'json',
      agent: {
        https: new https.Agent({
          ca: [
            await fs.promises.readFile(path.join(__dirname, '..', 'server', 'dist', 'credentials', 'cert.pem')),
            await fs.promises.readFile(path.join(__dirname, '..', 'server', 'dist', 'credentials', 'key.pem'))
          ]
        })
      },
      retry: 0
    });

  });

  it('should create manager account successfully', async function() {

    const res = await request('auth/signup', {
      method: 'POST',
      json: {
        username: 'e2etestmanager',
        password: 'Password4E2E!',
        manager: true
      }
    });

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

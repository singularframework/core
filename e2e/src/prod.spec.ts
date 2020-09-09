import launch from '../server/dist/main';
import tests from './server.spec';

describe('The Pit Store (prod)', async function() {

  before(async function() {

    // Set environment variables
    process.env.SINGULAR_CONFIG_PROFILE = 'prod';
    process.env.PIT_TOKEN_SECRET = 'dev-token-secret';

    // Run the server
    await launch();

  });

  tests(it);

});

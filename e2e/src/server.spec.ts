import got, { Got, Response } from 'got';
import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { expect } from 'chai';

export default (it: Mocha.TestFunction) => {

  let request: Got;
  let managerToken: string;
  let customerToken: string;
  let dummyItemId: string;
  const dummyItem = {
    type: 'single',
    title: 'Holy Hills',
    artist: 'System of a South',
    releaseDate: Date.now(),
    tracks: [{ title: 'Holy Hills', length: 2 }],
    price: 1,
    stock: 3
  };

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
      retry: 0,
      // Extract error messages from HTTP error responses
      hooks: {
        'beforeError': [error => {

          const res = <Response<ErrorResponse>>(error.response);

          if ( res && res.body && res.body.error ) {

            error.message = `${res.body.code}: ${res.body.message}`;
            error.code = res.body.code;

          }

          return error;

        }]
      }
    });

  });

  it('should create manager account successfully', async function() {

    const res = await request<SignupResponse>('auth/signup', {
      method: 'POST',
      json: {
        username: 'e2etestmanager',
        password: 'Password4E2E!',
        manager: true
      }
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('uid');

    // Validation tests
    try {

      await request('auth/signup', {
        method: 'POST',
        json: {
          username: 'e2e.test.manager',
          password: 'Password4E2E',
          manager: true
        }
      });

      throw new Error('Request should have been rejected!');

    }
    catch (error) {

      expect(error.message).to.not.equal('Request should have been rejected!');
      expect(error.response.body.error).to.be.true;
      expect(error.response.body.code).to.equal('VALIDATION_FAILED');

    }

    try {

      await request('auth/signup', {
        method: 'POST',
        json: {
          username: 'e2etestmanager',
          password: 'invalidpassword',
          manager: true
        }
      });

      throw new Error('Request should have been rejected!');

    }
    catch (error) {

      expect(error.message).to.not.equal('Request should have been rejected!');
      expect(error.response.body.error).to.be.true;
      expect(error.response.body.code).to.equal('VALIDATION_FAILED');

    }

    try {

      await request('auth/signup', {
        method: 'POST',
        json: {
          username: 'e2etestmanager',
          password: 'Password4E2E',
          manager: null
        }
      });

      throw new Error('Request should have been rejected!');

    }
    catch (error) {

      expect(error.message).to.not.equal('Request should have been rejected!');
      expect(error.response.body.error).to.be.true;
      expect(error.response.body.code).to.equal('VALIDATION_FAILED');

    }

  });

  it('should create customer account successfully', async function() {

    const res = await request<SignupResponse>('auth/signup', {
      method: 'POST',
      json: {
        username: 'e2etestcustomer',
        password: 'Password4E2E!'
      }
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('uid');

  });

  it('should authenticate manager successfully', async function() {

    const res = await request<LoginResponse>('auth/login', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from('e2etestmanager:Password4E2E!').toString('base64')
      }
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('token');

    managerToken = res.body.token;

  });

  it('should authenticate customer account successfully', async function() {

    const res = await request<LoginResponse>('auth/login', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from('e2etestcustomer:Password4E2E!').toString('base64')
      }
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('token');

    customerToken = res.body.token;

  });

  it('should add all items using a manager account successfully', async function() {

    // Increase timeout
    this.timeout(10000);

    // Scan data directory
    const files = (await fs.promises.readdir(path.resolve(__dirname, 'data'), { withFileTypes: true }))
    .filter(file => file.isFile());

    // Read each file
    for ( const file of files ) {

      const item = await fs.readJson(path.resolve(__dirname, 'data', file.name));

      // Set random stock and price
      item.price = Math.round(((Math.random() * 20) + 20 + Number.EPSILON) * 100) / 100;
      item.stock = Math.ceil(Math.random() * 50);

      // Upload item
      const res = await request<NewItemResponse>('item/new', {
        method: 'POST',
        searchParams: {
          token: managerToken
        },
        json: item
      });

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.have.property('id');

    }

    // Add dummy item
    const res = await request<NewItemResponse>('item/new', {
      method: 'POST',
      searchParams: {
        token: managerToken
      },
      json: dummyItem
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('id');

    dummyItemId = res.body.id;

  });

  it('should retrieve item info successfully', async function() {

    const res = await request<any>(`item/${dummyItemId}`);

    expect(res.statusCode).to.equal(200);
    expect(res.body.title).to.equal(dummyItem.title);
    expect(res.body.price).to.equal(dummyItem.price);

  });

  it('should update items using a manager account successfully', async function() {

    const res = await request<MessageResponse>(`item/${dummyItemId}/update`, {
      method: 'POST',
      searchParams: {
        token: managerToken
      },
      json: {
        title: 'Sacred Mountains',
        price: 399.99
      }
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('message');

    // Read item
    const itemRes = await request<any>(`item/${dummyItemId}`);

    expect(itemRes.statusCode).to.equal(200);
    expect(itemRes.body.title).to.equal('Sacred Mountains');
    expect(itemRes.body.price).to.equal(399.99);

  });

  it('should purchase items successfully', async function() {

    const res = await request.post<MessageResponse>(`item/${dummyItemId}/purchase`, {
      searchParams: {
        token: customerToken
      }
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('message');

    // Read item
    const itemRes = await request<any>(`item/${dummyItemId}`);

    expect(itemRes.statusCode).to.equal(200);
    expect(itemRes.body.stock).to.equal(dummyItem.stock - 1);

  });

  it('should delete items using a manager account successfully', async function() {

    const res = await request<MessageResponse>(`item/${dummyItemId}`, {
      method: 'DELETE',
      searchParams: {
        token: managerToken
      }
    });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('message');

  });

  it('should query items successfully', async function() {

    const res = await request<QueryResult[]>('items?q=lamb+of+god');

    expect(res.statusCode).to.equal(200);
    expect(res.body.constructor).to.equal(Array);

    for ( const result of res.body ) {

      expect(result).to.have.property('id');
      expect(result).to.have.property('title');
      expect(result).to.have.property('type');
      
    }

  });

  // Clean up
  after(function(done) {

    this.timeout(10000);

    setTimeout(async () => {

      await fs.move(path.join(__dirname, '..', 'server', 'dist', '.logs'), path.join(__dirname, '..', 'server', 'dist', `.logs-${process.env.SINGULAR_CONFIG_PROFILE}`));
      await fs.move(path.join(__dirname, '..', 'server', 'dist', '.data'), path.join(__dirname, '..', 'server', 'dist', `.data-${process.env.SINGULAR_CONFIG_PROFILE}`));

      done();

    }, 2000);

  });

};

interface SignupResponse {

  uid: string;

}

interface LoginResponse {

  token: string;

}

interface MessageResponse {

  message: string;

}

interface NewItemResponse {

  id: string;

}

interface ErrorResponse {

  error: true;
  message: string;
  code: string;

}

interface QueryResult {

  id: string;
  title: string;
  type: string;

}

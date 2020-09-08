import { Service, OnInit, OnConfig, ServerConfig } from '@singular/core';
import { User } from '@pit/model/user';
import { PitConfig } from '@pit/model/config';
import fs from 'fs-extra';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

@Service({
  name: 'users'
})
export class UsersService implements OnInit, OnConfig {

  private config: ServerConfig<PitConfig>;
  private collectionPath = path.join(__rootdir, '.data', 'users');

  async onInit() {

    await fs.ensureDir(this.collectionPath);

  }

  onConfig(config: ServerConfig<PitConfig>) {

    this.config = config;

  }

  /** Generates a random UID. */
  private generateUid() {

    const charset = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890';
    let uid = '';

    for ( let i = 0; i < 20; i++ ) {

      uid += charset[Math.floor(Math.random() * charset.length)];

    }

    return uid;

  }

  /** Generates a token from UID. */
  private async generateToken(uid: string) {

    return new Promise<string>((resolve, reject) => {

      jwt.sign({ uid }, this.config.tokenSecret, { expiresIn: this.config.tokenLifetime }, (error, token) => {

        if ( error ) return reject(error);
        resolve(token);

      });

    });

  }

  /** Returns a user document from username. */
  private async getUserByUsername(username: string): Promise<User> {

    const docNames = await fs.readdir(path.join(__rootdir, '.data', 'users'));

    for ( const docName of docNames ) {

      const doc: User = await fs.readJson(path.join(__rootdir, '.data', 'users', docName));

      if ( doc.username === username ) return doc;

    }

    return null;

  }

  /** Checks if a username is available. Can be used as a validator or directly. */
  static async usernameAvailable(username: string) {

    const docNames = await fs.readdir(path.join(__rootdir, '.data', 'users'));

    for ( const docName of docNames ) {

      const doc: User = await fs.readJson(path.join(__rootdir, '.data', 'users', docName));

      if ( doc.username === username ) return false;

    }

    return true;

  }

  /** Creates a user document and returns UID. */
  async createUser(username: string, password: string, manager: boolean) {

    const uid = this.generateUid();

    await fs.writeJson(path.join(__rootdir, '.data', 'users', `${uid}.json`), {
      id: uid,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      manager
    });

    return uid;

  }

  /** Authenticates a user and returns a token. */
  async authenticateUser(username: string, password: string) {

    // Find user
    const user = await this.getUserByUsername(username);

    if ( ! user ) throw new ServerError('User not found!', 400, 'AUTH_USER_NOT_FOUND');

    // Check password
    if ( ! await bcrypt.compare(password, user.passwordHash) )
      throw new ServerError('Invalid password!', 400, 'AUTH_INVALID_CREDENTIALS');

    // Return token
    return await this.generateToken(user.id);

  }

  /** Decrypts a token. */
  async decryptToken(token: string): Promise<TokenData> {

    return new Promise<TokenData>((resolve, reject) => {

      jwt.verify(token, this.config.tokenSecret, {}, (error, decoded: TokenData) => {

        if ( error ) return reject(error);
        resolve(decoded);

      });

    });

  }

  /** Returns a user document from UID. */
  async getUser(uid: string): Promise<User> {

    if ( ! await fs.pathExists(path.join(this.collectionPath, `${uid}.json`)) )
      throw new ServerError('User not found!', 400, 'USER_NOT_FOUND');

    return await fs.readJson(path.join(this.collectionPath, `${uid}.json`));

  }

}

export interface TokenData {

  uid: string;

}

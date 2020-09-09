import { Service, OnInit } from '@singular/core';
import { StoreItem, StoreItemType } from '@pit/model/item';
import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';
import levenshtein from 'fast-levenshtein';

@Service({
  name: 'store'
})
export class StoreService implements OnInit {

  private collectionPath = path.join(__rootdir, '.data', 'items');

  async onInit() {

    await fs.ensureDir(this.collectionPath);

  }

  /** Generates a random item ID. */
  private generateId() {

    const charset = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890';
    let id = '';

    for ( let i = 0; i < 20; i++ ) {

      id += charset[Math.floor(Math.random() * charset.length)];

    }

    return id;

  }

  /** Reads a store item by ID. */
  static async getItem(id: string): Promise<StoreItem> {

    if ( ! await fs.pathExists(path.join(__rootdir, '.data', 'items', `${id}.json`)) )
      throw new ServerError('Item not found!', 400, 'ITEM_NOT_FOUND');

    return await fs.readJson(path.join(__rootdir, '.data', 'items', `${id}.json`));

  }

  /** Creates a new item in the storage and returns its ID. */
  async newItem(item: Omit<StoreItem, 'id'>): Promise<string> {

    const id = this.generateId();

    await fs.writeJson(path.join(this.collectionPath, `${id}.json`), {
      id,
      ...item
    });

    return id;

  }

  /** Updates an item in the storage by ID. */
  async updateItem(id: string, item: Partial<Omit<StoreItem, 'id'>>) {

    const storeItem = await StoreService.getItem(id);

    _.merge(storeItem, item);

    await fs.writeJson(path.join(this.collectionPath, `${id}.json`), storeItem);

  }

  /** Deletes an item by ID. */
  async deleteItem(id: string) {

    if ( ! await fs.pathExists(path.join(this.collectionPath, `${id}.json`)) )
      throw new ServerError('Item not found!', 400, 'ITEM_NOT_FOUND');

    await fs.remove(path.join(this.collectionPath, `${id}.json`));

  }

  /** Queries all items in the storage and returns the result. */
  async queryItems(q: string): Promise<Array<Pick<StoreItem, 'id' | 'title' | 'type'>>> {

    // Generate regex from query string
    const query = new RegExp(
      q.replace(/\s+/g, ' ')
      .split(' ')
      .map(word => `${word}.*?`)
      .join('')
      , 'i');
    // Get all doc filenames
    const docPaths = (await fs.promises.readdir(this.collectionPath, { withFileTypes: true }))
    .filter(file => file.isFile())
    .map(file => file.name);
    // Matches array
    const matches: { id: string; title: string; type: StoreItemType }[] = [];

    // Match all document titles
    for ( const docPath of docPaths ) {

      const doc: StoreItem = await fs.readJson(path.join(this.collectionPath, docPath));

      if ( doc.title.match(query) ) matches.push({ id: doc.id, title: doc.title, type: doc.type });

    }

    // Sort the matches array based on levenshtein score
    return matches
    .map(match => ({ match, score: levenshtein.get(match.title, q.replace(/\s+/g, ' ')) }))
    .sort((a, b) => a.score - b.score)
    .map(item => item.match);

  }

}

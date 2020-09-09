import { Service, OnInit } from '@singular/core';
import path from 'path';
import fs from 'fs-extra';

@Service({
  name: 'session'
})
export class SessionService implements OnInit {

  private collectionPath = path.join(__rootdir, '.data', 'sessions');

  async onInit() {

    await fs.ensureDir(this.collectionPath);

    session
    .on('created', async id => {

      await fs.writeJson(path.join(this.collectionPath, `${id}.json`), { id });

    })
    .on('claim:set', async (id, key, value) => {

      await fs.writeJson(path.join(this.collectionPath, `${id}.json`), {
        ...(await fs.readJson(path.join(this.collectionPath, `${id}.json`))),
        [key]: value
      });

    })
    .on('claim:get', async (id, key) => {

      return (await fs.readJson(path.join(this.collectionPath, `${id}.json`)))[key];

    });

  }

}

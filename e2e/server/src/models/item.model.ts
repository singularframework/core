import { DateTime } from 'luxon';

export interface StoreItem {

  id: string;
  type: StoreItemType;
  title: string;
  artist: string;
  releaseDate: DateTime;
  tracks: Array<MusicTrack>;
  price: number;
  stock: number;

}

export enum StoreItemType {

  Album = 'album',
  Single = 'single',
  EP = 'ep',
  Live = 'live'

}

export interface MusicTrack {

  title: string;
  /** In seconds. */
  length: number;

}

export interface StoreItem {

  id: string;
  type: StoreItemType;
  title: string;
  artist: string;
  releaseDate: number;
  tracks: Array<MusicTrack>;
  price: number;
  stock: number;

}

export enum StoreItemType {

  Album = 'album',
  Single = 'single'

}

export interface MusicTrack {

  title: string;
  /** In seconds. */
  length: number;

}

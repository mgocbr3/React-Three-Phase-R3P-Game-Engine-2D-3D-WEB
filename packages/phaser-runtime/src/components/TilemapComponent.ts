import Component from '../Component.js';
import type { ComponentJSON } from '../types.js';

export interface TilemapComponentJSON extends ComponentJSON {
  type: 'pixl.tilemap';
  /** Path to the .json/.tmj tilemap. */
  tilemapPath: string;
  /** Tileset image keys + paths. */
  tilesets?: Array<{ key: string; path: string }>;
  layers?: string[];
}

export default class TilemapComponent extends Component {
  declare readonly type: 'pixl.tilemap';

  constructor(json: Partial<TilemapComponentJSON> & { type?: 'pixl.tilemap' }) {
    if (!json.tilemapPath) throw new Error('TilemapComponent: tilemapPath required');
    super({ ...json, type: 'pixl.tilemap' } as ComponentJSON);
  }

  get tilemapPath(): string { return this.props.tilemapPath as string; }
  get tilesets(): Array<{ key: string; path: string }> {
    return (this.props.tilesets as Array<{ key: string; path: string }> | undefined) ?? [];
  }
  get layers(): string[] { return (this.props.layers as string[] | undefined) ?? []; }
}

import Component from '../Component.js';
import type { ComponentJSON } from '../types.js';

export interface SpriteComponentJSON extends ComponentJSON {
  type: 'pixl.sprite';
  textureKey?: string;
  /** Asset path (Assets/Sprites/*.png) — resolved by the asset loader. */
  texturePath?: string;
  frame?: string | number;
  flipX?: boolean;
  flipY?: boolean;
  origin?: { x: number; y: number };
  tint?: number;
  alpha?: number;
}

export default class SpriteComponent extends Component {
  declare readonly type: 'pixl.sprite';

  constructor(json: Partial<SpriteComponentJSON> & { type?: 'pixl.sprite' }) {
    super({ ...json, type: 'pixl.sprite' } as ComponentJSON);
  }

  get textureKey(): string | undefined { return this.props.textureKey as string | undefined; }
  get texturePath(): string | undefined { return this.props.texturePath as string | undefined; }
  get frame(): string | number | undefined { return this.props.frame as string | number | undefined; }
  get flipX(): boolean { return this.props.flipX === true; }
  get flipY(): boolean { return this.props.flipY === true; }
  get tint(): number | undefined { return this.props.tint as number | undefined; }
  get alpha(): number { return typeof this.props.alpha === 'number' ? this.props.alpha : 1; }
}

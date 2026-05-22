import Component from '../Component.js';
import type { ComponentJSON } from '../types.js';

export type Physics2DBodyKind = 'static' | 'dynamic' | 'kinematic';
export type Physics2DShape = 'box' | 'circle' | 'polygon';

export interface Physics2DComponentJSON extends ComponentJSON {
  type: 'pixl.physics2d';
  body: Physics2DBodyKind;
  shape: Physics2DShape;
  /** Box-shape size or circle radius (radius uses .x only). */
  size?: { x: number; y: number };
  mass?: number;
  friction?: number;
  restitution?: number;
  /** Raw polygon vertices when shape='polygon'. */
  vertices?: Array<{ x: number; y: number }>;
}

export default class Physics2DComponent extends Component {
  declare readonly type: 'pixl.physics2d';

  constructor(json: Partial<Physics2DComponentJSON> & { type?: 'pixl.physics2d' }) {
    if (!json.body) throw new Error('Physics2DComponent: body required (static|dynamic|kinematic)');
    if (!json.shape) throw new Error('Physics2DComponent: shape required (box|circle|polygon)');
    super({ ...json, type: 'pixl.physics2d' } as ComponentJSON);
  }

  get body(): Physics2DBodyKind { return this.props.body as Physics2DBodyKind; }
  get shape(): Physics2DShape { return this.props.shape as Physics2DShape; }
  get size(): { x: number; y: number } | undefined { return this.props.size as { x: number; y: number } | undefined; }
  get mass(): number { return typeof this.props.mass === 'number' ? this.props.mass : 1; }
}

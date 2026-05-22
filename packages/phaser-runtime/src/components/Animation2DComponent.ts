import Component from '../Component.js';
import type { ComponentJSON } from '../types.js';

export interface Animation2DFrame {
  key: string;
  frame?: string | number;
  duration?: number;
}

export interface Animation2DComponentJSON extends ComponentJSON {
  type: 'pixl.animation2d';
  /** Phaser animation key — must be unique within a scene. */
  animationKey: string;
  frames: Animation2DFrame[];
  frameRate?: number;
  repeat?: number; // -1 = infinite
  yoyo?: boolean;
}

export default class Animation2DComponent extends Component {
  declare readonly type: 'pixl.animation2d';

  constructor(json: Partial<Animation2DComponentJSON> & { type?: 'pixl.animation2d' }) {
    if (!json.animationKey) throw new Error('Animation2DComponent: animationKey required');
    if (!Array.isArray(json.frames) || json.frames.length === 0) {
      throw new Error('Animation2DComponent: frames must be a non-empty array');
    }
    super({ ...json, type: 'pixl.animation2d' } as ComponentJSON);
  }

  get animationKey(): string { return this.props.animationKey as string; }
  get frames(): Animation2DFrame[] { return this.props.frames as Animation2DFrame[]; }
  get frameRate(): number { return typeof this.props.frameRate === 'number' ? this.props.frameRate : 12; }
  get repeat(): number { return typeof this.props.repeat === 'number' ? this.props.repeat : 0; }
  get yoyo(): boolean { return this.props.yoyo === true; }
}

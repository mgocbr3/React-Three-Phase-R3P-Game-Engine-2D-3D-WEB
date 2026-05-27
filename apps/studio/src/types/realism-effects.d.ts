declare module 'realism-effects' {
  import {
    Effect,
    EffectComposer,
    Pass,
  } from 'postprocessing';
  import {
    Camera,
    Scene,
  } from 'three';

  type RealismOptions = Record<string, unknown>;

  export class VelocityDepthNormalPass extends Pass {
    constructor(scene: Scene, camera: Camera);
    texture: unknown;
  }

  export class SSGIEffect extends Effect {
    constructor(
      composer: EffectComposer,
      scene: Scene,
      camera: Camera,
      options?: RealismOptions,
    );
  }

  export class HBAOEffect extends Effect {
    constructor(
      composer: EffectComposer,
      camera: Camera,
      scene: Scene,
      options?: RealismOptions,
    );
  }

  export class TRAAEffect extends Effect {
    constructor(
      scene: Scene,
      camera: Camera,
      velocityDepthNormalPass: VelocityDepthNormalPass,
      options?: RealismOptions,
    );
  }

  export class MotionBlurEffect extends Effect {
    constructor(
      velocityDepthNormalPass: VelocityDepthNormalPass,
      options?: RealismOptions,
    );
  }

  export class SharpnessEffect extends Effect {
    constructor(options?: RealismOptions);
  }
}

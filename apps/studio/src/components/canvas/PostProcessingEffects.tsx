/**
 * Post-processing effects component.
 *
 * Uses native Three.js post-processing (Bloom, Vignette, Noise via
 * a custom EffectComposer in `effects/RTXPostProcessing.tsx`).
 *
 * NOTE: We tried adopting `realism-effects@1.1.2` (0beqz) for SSGI/
 * HBAO/SSR/TRAA but the lib still imports `WebGLMultipleRenderTargets`
 * which was removed from Three.js in ~0.162. Our Three.js is 0.184.
 * See `docs/REALISM-SHADERS-EVAL.md` for the incompatibility note and
 * the forking path that would unblock SSGI integration.
 */

import { RTXEffectsWithSettings } from './effects/RTXPostProcessing';

export const PostProcessingEffects = () => {
  return <RTXEffectsWithSettings />;
};

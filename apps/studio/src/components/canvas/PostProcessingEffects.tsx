/**
 * Post-processing effects component.
 *
 * Currently uses the legacy RTX stack (Bloom / Vignette / Noise via a
 * three/examples EffectComposer). The new `RealismEffects.tsx` based on
 * the vendored fork of realism-effects (HBAO + drei wrappers) is built
 * but NOT wired in — last attempt to swap caused the entire React tree
 * to fail to mount with no clear stack trace. The fork patch itself is
 * solid (see tools/vendor/realism-effects/PATCH-NOTES.md); the failure
 * is somewhere in the EffectComposer mount path. Future session should:
 *   1. Confirm whether @react-three/postprocessing's <EffectComposer>
 *      and `useEffect` lifecycle for `VelocityDepthNormalPass` actually
 *      compose correctly under R3F v9 / React 19
 *   2. Possibly skip the wrapper and use vanilla postprocessing.js
 *      EffectComposer attached via `useThree(({gl})...)` like the RTX
 *      legacy stack already does
 *
 * Until then, the safe path is the RTX stack — it works.
 */

import { RTXEffectsWithSettings } from './effects/RTXPostProcessing';

export const PostProcessingEffects = () => {
  return <RTXEffectsWithSettings />;
};

/**
 * Post-processing effects component.
 *
 * Wires the realism-effects (0beqz, MIT) stack via the vanilla
 * `postprocessing` library (Vanruesc). See `effects/RealismEffects.tsx`
 * for the pipeline details.
 *
 * Keep this R3F path narrow; native Three rendering owns its own composer.
 */

import { RealismEffects } from './effects/RealismEffects';

export const PostProcessingEffects = () => {
  return <RealismEffects />;
};

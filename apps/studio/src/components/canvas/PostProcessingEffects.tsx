/**
 * Post-processing effects component.
 *
 * Wires the realism-effects (0beqz, MIT) stack via the vanilla
 * `postprocessing` library (Vanruesc). See `effects/RealismEffects.tsx`
 * for the pipeline details.
 *
 * The legacy `effects/RTXPostProcessing.tsx` is kept in the repo for
 * one more session as a documented fallback in case we need to revert,
 * but it is no longer mounted. It will be deleted in a follow-up commit
 * once RealismEffects has shipped clean in production builds.
 */

import { RealismEffects } from './effects/RealismEffects';

export const PostProcessingEffects = () => {
  return <RealismEffects />;
};

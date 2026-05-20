/**
 * Post-processing effects component.
 * 
 * Uses native Three.js post-processing instead of @react-three/postprocessing
 * which has compatibility issues with React 19 / R3F v9.
 * 
 * Features:
 * - Bloom (Unreal Engine style)
 * - Vignette
 * - Color Grading (saturation, contrast, temperature)
 * - Film Grain (optional)
 */

import { RTXEffectsWithSettings } from './effects/RTXPostProcessing';

export const PostProcessingEffects = () => {
  return <RTXEffectsWithSettings />;
};

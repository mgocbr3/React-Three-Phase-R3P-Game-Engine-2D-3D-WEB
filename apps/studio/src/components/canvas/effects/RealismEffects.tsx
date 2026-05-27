// High-realism post-processing stack.
//
// Uses @react-three/postprocessing (Bloom, Vignette, Noise) plus the
// patched copy of realism-effects (0beqz, MIT) living at
// tools/vendor/realism-effects/src/. The patch swaps the removed
// WebGLMultipleRenderTargets API for the new WebGLRenderTarget({count})
// shape that Three.js 0.162+ ships with. See PATCH-NOTES.md in the
// vendor folder for the diff summary.
//
// Effects mounted (all toggleable via EngineSettings):
//   - HBAO (Horizon-Based AO) — cheap (~1-2ms), big visual win
//   - Bloom (drei wrapper) — keeps the studio's existing slider config
//   - Vignette
//   - Noise (film grain)
//
// SSGI/SSR/TRAA/MotionBlur are deliberately NOT mounted in this first
// pass — they introduce more render-target ping-pong and we want to
// confirm the basic stack works before we bring them in. The vendor
// patch covers them too, so flipping them on later is a one-liner.
//
// Attribution & sponsor:
//   Effects by 0beqz (https://github.com/0beqz/realism-effects, MIT).
//   Support: https://buymeacoffee.com/0beqz

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — vendored fork has no type declarations
import { VelocityDepthNormalPass, HBAOEffect } from 'realism-effects';
import { useEngineSettings } from '@/stores/engineSettingsStore';

export const RealismEffects = () => {
  const { scene, camera } = useThree();
  const settings = useEngineSettings();

  // Shared velocity/depth/normal buffer pass. SSGI/SSR/MotionBlur all
  // would sample from this; HBAO needs it for the contact-shadow info.
  const velocityDepthNormalPass = useMemo(
    () => new VelocityDepthNormalPass(scene, camera),
    [scene, camera],
  );

  const hbao = useMemo(
    () => new HBAOEffect(velocityDepthNormalPass, camera, scene),
    [velocityDepthNormalPass, camera, scene],
  );

  return (
    <EffectComposer multisampling={0}>
      <primitive object={velocityDepthNormalPass} />
      <primitive object={hbao} />
      {settings.bloom && (
        <Bloom
          intensity={settings.bloomIntensity ?? 1.0}
          luminanceThreshold={settings.bloomThreshold ?? 0.9}
          luminanceSmoothing={0.025}
          mipmapBlur
          radius={settings.bloomRadius ?? 0.4}
        />
      )}
      {settings.vignette && (
        <Vignette
          eskil={false}
          offset={0.3}
          darkness={settings.vignetteIntensity ?? 0.5}
        />
      )}
      {settings.noise && (
        <Noise
          opacity={settings.noiseIntensity ?? 0.05}
          blendFunction={BlendFunction.SOFT_LIGHT}
        />
      )}
    </EffectComposer>
  );
};

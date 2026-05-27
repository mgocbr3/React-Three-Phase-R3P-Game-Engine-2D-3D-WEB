// RealismEffects — high-end post-processing stack.
//
// Replaces the legacy `RTXPostProcessing` (which uses `three/examples`
// EffectComposer + manual ShaderPasses). This component uses the same
// vanilla pattern but with the `postprocessing` library (Vanruesc) so
// the realism-effects (0beqz, MIT) classes — which extend
// `postprocessing.Effect` / `postprocessing.Pass` — can be plugged in
// directly.
//
// Why NOT `@react-three/postprocessing`?
//   The R3F wrapper for `postprocessing` declares its own reconciler
//   for `<EffectComposer>` children and expects them to be wrapped
//   React components. Passing raw `postprocessing.Effect`/`Pass`
//   instances as `<primitive>` doesn't survive the mount path under
//   R3F v9 / React 19 — last time we tried, the entire tree failed
//   to mount with no clear stack trace. RTXPostProcessing already
//   proved the vanilla loop works fine, so we follow that pattern.
//
// Render loop:
//   `useFrame(..., 1)` with positive priority suppresses R3F's
//   default `gl.render(scene, camera)`. We then drive the composer
//   via `composer.render(delta)` ourselves.
//
// Pipeline order (matches realism-effects example/main.js):
//   1. RenderPass(scene, camera)
//   2. VelocityDepthNormalPass(scene, camera)  ← shared buffer
//   3. EffectPass(camera, HBAOEffect)          ← optional via settings.ssao
//   4. EffectPass(camera, TRAAEffect)          ← optional via settings.antialias
//   5. EffectPass(camera, MotionBlurEffect)    ← optional via settings.motionBlur
//   6. EffectPass(camera, Bloom, Vignette, Noise)  ← merged cosmetic pass
//
// SSGI/SSR/Sharpness/LensDistortion are deliberately NOT mounted in
// this first pass — they require env-map setup and heavier RT
// ping-pong that we want to validate separately. Flipping them on is
// a one-liner once the base path is stable.
//
// Attribution & sponsor:
//   Effects by 0beqz (https://github.com/0beqz/realism-effects, MIT).
//   Support: https://buymeacoffee.com/0beqz

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
} from 'postprocessing';
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-expect-error — vendored fork has no type declarations
import { VelocityDepthNormalPass, HBAOEffect, TRAAEffect, MotionBlurEffect } from 'realism-effects';
/* eslint-enable @typescript-eslint/ban-ts-comment */
import { useEngineSettings } from '@/stores/engineSettingsStore';

export const RealismEffects = () => {
  const { gl, scene, camera, size } = useThree();
  const settings = useEngineSettings();
  const composerRef = useRef<EffectComposer | null>(null);

  // Pull out the toggles + numeric knobs we care about.  We rebuild the
  // composer whenever any of these change (cheap — most of the cost is
  // the velocity/depth buffer, which is created once per composer).
  const {
    antialias,
    ssao: hbaoEnabled,
    motionBlur: motionBlurEnabled,
    motionBlurIntensity,
    motionBlurSamples,
    bloom,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    vignette,
    vignetteIntensity,
    vignetteOffset,
    noise,
    noiseIntensity,
  } = settings;

  useEffect(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
    });

    composer.addPass(new RenderPass(scene, camera));

    // Shared velocity/depth/normal buffer — consumed by HBAO/TRAA/MotionBlur.
    // Always added so the toggles below can be flipped without recreating
    // the composer (well, they do recreate, but the pass setup is uniform).
    const velocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera);
    composer.addPass(velocityDepthNormalPass);

    // HBAO — horizon-based ambient occlusion. Hooked to the existing
    // `ssao` toggle in EngineSettings (the toggle is rendered as
    // "Ambient Occlusion" in the UI; HBAO is its current implementation).
    if (hbaoEnabled) {
      const hbao = new HBAOEffect(composer, camera, scene);
      composer.addPass(new EffectPass(camera, hbao));
    }

    // TRAA — temporal reprojection antialiasing. When antialias is on,
    // we route it through TRAA instead of the renderer's MSAA (which
    // is disabled at composer level by frameBufferType=HalfFloat).
    if (antialias) {
      const traa = new TRAAEffect(scene, camera, velocityDepthNormalPass);
      composer.addPass(new EffectPass(camera, traa));
    }

    // Motion blur — per-object via velocity buffer.
    if (motionBlurEnabled) {
      const motionBlur = new MotionBlurEffect(velocityDepthNormalPass, {
        intensity: motionBlurIntensity ?? 1,
        jitter: 1,
        samples: motionBlurSamples ?? 16,
      });
      composer.addPass(new EffectPass(camera, motionBlur));
    }

    // Merged cosmetic pass — bloom + vignette + noise share one EffectPass
    // so they're applied in a single fragment shader, saving render
    // targets vs one pass per effect.
    const cosmeticEffects: import('postprocessing').Effect[] = [];
    if (bloom) {
      cosmeticEffects.push(
        new BloomEffect({
          intensity: bloomIntensity ?? 1.0,
          luminanceThreshold: bloomThreshold ?? 0.9,
          luminanceSmoothing: 0.025,
          mipmapBlur: true,
          radius: bloomRadius ?? 0.4,
        }),
      );
    }
    if (vignette) {
      cosmeticEffects.push(
        new VignetteEffect({
          eskil: false,
          offset: vignetteOffset ?? 0.3,
          darkness: vignetteIntensity ?? 0.5,
        }),
      );
    }
    if (noise) {
      cosmeticEffects.push(
        new NoiseEffect({
          blendFunction: BlendFunction.SOFT_LIGHT,
          premultiply: false,
        }),
      );
      // NoiseEffect doesn't expose intensity directly; use blendMode opacity.
      const noiseEffect = cosmeticEffects[cosmeticEffects.length - 1] as NoiseEffect;
      noiseEffect.blendMode.opacity.value = noiseIntensity ?? 0.05;
    }
    if (cosmeticEffects.length > 0) {
      composer.addPass(new EffectPass(camera, ...cosmeticEffects));
    }

    composer.setSize(size.width, size.height);
    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [
    gl, scene, camera,
    antialias, hbaoEnabled, motionBlurEnabled,
    motionBlurIntensity, motionBlurSamples,
    bloom, bloomIntensity, bloomThreshold, bloomRadius,
    vignette, vignetteIntensity, vignetteOffset,
    noise, noiseIntensity,
    // size intentionally excluded — handled separately below
  ]);

  // Resize hook — postprocessing handles internal RT resize via setSize.
  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size]);

  // Drive the composer instead of R3F's default render.
  // priority > 0 makes useFrame the renderer; R3F's auto-render is suppressed.
  useFrame((_state, delta) => {
    composerRef.current?.render(delta);
  }, 1);

  return null;
};

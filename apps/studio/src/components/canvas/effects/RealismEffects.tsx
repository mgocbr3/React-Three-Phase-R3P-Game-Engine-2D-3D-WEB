// RealismEffects — ULTRA REALISM post-processing stack.
//
// Full realism-effects (0beqz, MIT) pipeline wired via the vanilla
// `postprocessing` library (Vanruesc). The R3F wrapper
// (`@react-three/postprocessing`) doesn't compose cleanly under R3F v9
// / React 19, so we drive the composer directly via useFrame priority 1
// (suppresses R3F's default `gl.render`).
//
// Pipeline (matches realism-effects example/main.js, ultra config):
//   1. RenderPass(scene, camera)
//   2. VelocityDepthNormalPass(scene, camera)         ← shared G-buffer
//   3. EffectPass(SSGIEffect)                          ← screen-space GI
//   4. EffectPass(HBAOEffect, spp:16, distance:5)      ← ultra-quality AO
//   5. EffectPass(TRAAEffect)                          ← temporal AA
//   6. EffectPass(MotionBlurEffect)                    ← optional
//   7. EffectPass(Sharpness, Bloom, Vignette, Noise, ACES ToneMapping)
//
// Tone mapping is OWNED BY the post-processing pipeline (ACES via
// ToneMappingEffect at the end of the cosmetic pass). The renderer's
// `gl.toneMapping` is forced to `NoToneMapping` on mount and restored
// on unmount — otherwise we'd double-tone-map.
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
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  Effect,
} from 'postprocessing';
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-expect-error — vendored fork has no type declarations
import {
  VelocityDepthNormalPass,
  SSGIEffect,
  HBAOEffect,
  TRAAEffect,
  MotionBlurEffect,
  SharpnessEffect,
} from 'realism-effects';
/* eslint-enable @typescript-eslint/ban-ts-comment */
import { useEngineSettings } from '@/stores/engineSettingsStore';

export const RealismEffects = () => {
  const { gl, scene, camera, size } = useThree();
  const settings = useEngineSettings();
  const composerRef = useRef<EffectComposer | null>(null);

  // Pull out the toggles + numeric knobs we care about. The composer
  // rebuilds whenever any of these change (cheap — most cost is the
  // velocity/depth buffer, which is created once per composer).
  const {
    antialias,
    ssao: hbaoEnabled,
    ssr: ssgiEnabled,    // we re-purpose the `ssr` toggle to drive SSGI (which
                         // does diffuse GI + reflections in one effect; SSR alone
                         // is a strict subset of SSGI)
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

  // Override the renderer's tone mapping while we're mounted — the
  // pipeline owns it now (via ToneMappingEffect ACES Filmic). Restore
  // on unmount so other paths (e.g. RTX legacy fallback) still work.
  useEffect(() => {
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    gl.toneMapping = THREE.NoToneMapping;
    gl.toneMappingExposure = 1;
    return () => {
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
    };
  }, [gl]);

  useEffect(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
    });

    composer.addPass(new RenderPass(scene, camera));

    // Shared velocity/depth/normal G-buffer pass — consumed by HBAO/
    // TRAA/SSGI/MotionBlur. Always added so the toggles below can be
    // flipped without architectural changes.
    const velocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera);
    composer.addPass(velocityDepthNormalPass);

    // ── SSGI (Screen-Space Global Illumination) ────────────────────
    // Single biggest visual upgrade. Adds:
    //   - diffuse light bounce (color bleed between surfaces)
    //   - specular reflections on shiny/rough materials
    // Hooked to the existing `ssr` toggle (SSR is a subset of SSGI).
    if (ssgiEnabled) {
      const ssgi = new SSGIEffect(composer, scene, camera, {
        mode: 'ssgi',
        distance: 5,
        thickness: 1.5,
        denoiseIterations: 2,
        radius: 4,
        steps: 24,
        refineSteps: 5,
        resolutionScale: 1,
        missedRays: false,
        velocityDepthNormalPass,
      });
      composer.addPass(new EffectPass(camera, ssgi));
    }

    // ── HBAO (Horizon-Based Ambient Occlusion, ultra-quality) ──────
    if (hbaoEnabled) {
      const hbao = new HBAOEffect(composer, camera, scene, {
        spp: 16,       // samples per pixel (default 8)
        distance: 5,   // sample radius in world units (default 2)
        distancePower: 1,
        power: 2,
        bias: 35,
        thickness: 0.075,
        velocityDepthNormalPass,
      });
      composer.addPass(new EffectPass(camera, hbao));
    }

    // ── TRAA (Temporal Reprojection AA) ────────────────────────────
    // Smoother than MSAA at no per-pixel cost; jitters subpixel
    // positions and accumulates across frames.
    if (antialias) {
      const traa = new TRAAEffect(scene, camera, velocityDepthNormalPass);
      composer.addPass(new EffectPass(camera, traa));
    }

    // ── Motion blur (per-object via velocity buffer) ───────────────
    if (motionBlurEnabled) {
      const motionBlur = new MotionBlurEffect(velocityDepthNormalPass, {
        intensity: motionBlurIntensity ?? 1,
        jitter: 1,
        samples: motionBlurSamples ?? 16,
      });
      composer.addPass(new EffectPass(camera, motionBlur));
    }

    // ── Final cosmetic pass ───────────────────────────────────────
    // Merged into one EffectPass so they share a single fragment
    // shader invocation. ORDER MATTERS: sharpness → bloom → vignette →
    // noise → tone mapping.
    const finalEffects: Effect[] = [];

    // Sharpness counter-balances the slight blur that TRAA introduces.
    // Only useful when antialias is on; cheap to apply unconditionally.
    finalEffects.push(new SharpnessEffect({ sharpness: 0.6 }));

    if (bloom) {
      finalEffects.push(
        new BloomEffect({
          intensity: bloomIntensity ?? 1.0,
          luminanceThreshold: bloomThreshold ?? 0.85,
          luminanceSmoothing: 0.025,
          mipmapBlur: true,
          radius: bloomRadius ?? 0.5,
        }),
      );
    }
    if (vignette) {
      finalEffects.push(
        new VignetteEffect({
          eskil: false,
          offset: vignetteOffset ?? 0.3,
          darkness: vignetteIntensity ?? 0.4,
        }),
      );
    }
    if (noise) {
      const noiseEffect = new NoiseEffect({
        blendFunction: BlendFunction.SOFT_LIGHT,
        premultiply: false,
      });
      noiseEffect.blendMode.opacity.value = noiseIntensity ?? 0.05;
      finalEffects.push(noiseEffect);
    }

    // ACES Filmic tone mapping — the de-facto cinematic standard since
    // ~2017, used by Unreal Engine. Compresses HDR into LDR without
    // washing out highlights. ALWAYS LAST in the chain.
    finalEffects.push(
      new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC,
      }),
    );

    composer.addPass(new EffectPass(camera, ...finalEffects));

    composer.setSize(size.width, size.height);
    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [
    gl, scene, camera,
    antialias, hbaoEnabled, ssgiEnabled, motionBlurEnabled,
    motionBlurIntensity, motionBlurSamples,
    bloom, bloomIntensity, bloomThreshold, bloomRadius,
    vignette, vignetteIntensity, vignetteOffset,
    noise, noiseIntensity,
    // size handled separately below
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

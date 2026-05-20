import { useEffect, useRef, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useEditorStore } from '@/stores/editorStore';
import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  SSAOEffect,
  NormalPass,
  BrightnessContrastEffect,
  HueSaturationEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
  SMAAPreset,
  GodRaysEffect,
  KernelSize,
} from 'postprocessing';

/**
 * Advanced post-processing pipeline using the base 'postprocessing' library.
 * This bypasses @react-three/postprocessing which has compatibility issues with React 19 / R3F v9.
 * 
 * Features:
 * - Bloom with configurable intensity/threshold/radius
 * - Vignette with offset and darkness controls
 * - Film grain noise
 * - SSAO (Screen Space Ambient Occlusion)
 * - Depth of Field with bokeh
 * - Chromatic Aberration
 * - Color Grading (brightness, contrast, saturation, hue)
 * - God Rays (volumetric light shafts)
 * - SMAA anti-aliasing
 * - Tone Mapping (ACES, Reinhard, etc.)
 */
export const ManualPostProcessing = () => {
  const { gl, scene, camera, size } = useThree();
  const settings = useEngineSettings();
  const { objects } = useEditorStore();
  
  const {
    // Basic
    bloom, bloomIntensity, bloomThreshold, bloomRadius,
    vignette, vignetteIntensity, vignetteOffset,
    noise, noiseIntensity,
    // Advanced
    ssao, ssaoIntensity, ssaoRadius, ssaoBias,
    depthOfField, dofFocusDistance, dofFocalLength, dofBokehScale,
    chromaticAberration, chromaticAberrationOffset,
    // Color Grading
    colorGrading, brightness, contrast, saturation, hue,
    // God Rays
    godRays, godRaysIntensity, godRaysDecay, godRaysDensity,
    // Tone Mapping
    toneMapping,
  } = settings;

  const composerRef = useRef<EffectComposer | null>(null);
  const normalPassRef = useRef<NormalPass | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  
  // Find sun light for god rays
  const sunLight = useMemo(() => {
    return objects.find(obj => obj.type === 'sunlight' && obj.visible);
  }, [objects]);

  // Check if any effect is enabled
  const hasEffects = bloom || vignette || noise || ssao || depthOfField || 
                     chromaticAberration || colorGrading || godRays;

  // Create composer and effects
  useEffect(() => {
    // Always clean up first
    if (composerRef.current) {
      composerRef.current.dispose();
      composerRef.current = null;
    }
    if (normalPassRef.current) {
      normalPassRef.current = null;
    }
    if (sunMeshRef.current) {
      scene.remove(sunMeshRef.current);
      sunMeshRef.current.geometry.dispose();
      (sunMeshRef.current.material as THREE.Material).dispose();
      sunMeshRef.current = null;
    }

    if (!hasEffects) {
      return;
    }

    try {
      // Create new composer with multisampling for quality
      const composer = new EffectComposer(gl, {
        frameBufferType: THREE.HalfFloatType,
        multisampling: 4,
      });

      // Add render pass (renders the scene)
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      // Normal pass for SSAO (required)
      let normalPass: NormalPass | null = null;
      if (ssao) {
        normalPass = new NormalPass(scene, camera);
        composer.addPass(normalPass);
        normalPassRef.current = normalPass;
      }

      // Create effects array
      const effects: Array<any> = [];

      // === SSAO Effect ===
      if (ssao && normalPass) {
        const ssaoEffect = new SSAOEffect(camera, normalPass.texture, {
          blendFunction: BlendFunction.MULTIPLY,
          distanceScaling: true,
          depthAwareUpsampling: true,
          samples: 16,
          rings: 4,
          luminanceInfluence: 0.7,
          radius: ssaoRadius,
          intensity: ssaoIntensity,
          bias: ssaoBias,
          fade: 0.01,
          resolutionScale: 0.5,
        });
        effects.push(ssaoEffect);
      }

      // === Depth of Field Effect ===
      if (depthOfField) {
        const dofEffect = new DepthOfFieldEffect(camera, {
          focusDistance: dofFocusDistance / 100,
          focalLength: dofFocalLength / 1000,
          bokehScale: dofBokehScale,
          height: 480,
        });
        effects.push(dofEffect);
      }

      // === God Rays Effect ===
      if (godRays && sunLight) {
        // Create a small sun mesh for god rays source
        const sunPosition = new THREE.Vector3(...sunLight.position);
        const sunMesh = new THREE.Mesh(
          new THREE.SphereGeometry(5, 16, 16),
          new THREE.MeshBasicMaterial({ 
            color: sunLight.color || 0xffffcc,
            transparent: true,
            opacity: 0,
          })
        );
        sunMesh.position.copy(sunPosition);
        scene.add(sunMesh);
        sunMeshRef.current = sunMesh;

        const godRaysEffect = new GodRaysEffect(camera, sunMesh, {
          blendFunction: BlendFunction.SCREEN,
          samples: 60,
          density: godRaysDensity,
          decay: godRaysDecay,
          weight: godRaysIntensity,
          exposure: 0.6,
          clampMax: 1.0,
          kernelSize: KernelSize.SMALL,
        });
        effects.push(godRaysEffect);
      }

      // === Bloom Effect ===
      if (bloom) {
        const bloomEffect = new BloomEffect({
          intensity: bloomIntensity,
          luminanceThreshold: bloomThreshold,
          luminanceSmoothing: bloomRadius,
          mipmapBlur: true,
          kernelSize: KernelSize.LARGE,
        });
        effects.push(bloomEffect);
      }

      // === Chromatic Aberration ===
      if (chromaticAberration) {
        const chromaticEffect = new ChromaticAberrationEffect({
          offset: new THREE.Vector2(chromaticAberrationOffset, chromaticAberrationOffset),
          radialModulation: true,
          modulationOffset: 0.3,
        });
        effects.push(chromaticEffect);
      }

      // === Color Grading ===
      if (colorGrading) {
        // Brightness & Contrast
        const bcEffect = new BrightnessContrastEffect({
          brightness: brightness,
          contrast: contrast,
        });
        effects.push(bcEffect);

        // Hue & Saturation
        const hsEffect = new HueSaturationEffect({
          hue: hue * Math.PI, // Convert to radians
          saturation: saturation,
        });
        effects.push(hsEffect);
      }

      // === Tone Mapping ===
      const toneMappingModeMap: Record<string, ToneMappingMode> = {
        'aces': ToneMappingMode.ACES_FILMIC,
        'reinhard': ToneMappingMode.REINHARD,
        'cineon': ToneMappingMode.OPTIMIZED_CINEON,
        'linear': ToneMappingMode.LINEAR,
        'none': ToneMappingMode.LINEAR,
      };
      
      const toneMappingEffect = new ToneMappingEffect({
        mode: toneMappingModeMap[toneMapping] || ToneMappingMode.ACES_FILMIC,
        resolution: 256,
        whitePoint: 4.0,
        middleGrey: 0.6,
        minLuminance: 0.01,
        averageLuminance: 1.0,
        adaptationRate: 1.0,
      });
      effects.push(toneMappingEffect);

      // === Vignette Effect ===
      if (vignette) {
        const vignetteEffect = new VignetteEffect({
          offset: vignetteOffset,
          darkness: vignetteIntensity,
          blendFunction: BlendFunction.NORMAL,
        });
        effects.push(vignetteEffect);
      }

      // === Film Grain Noise ===
      if (noise) {
        const noiseEffect = new NoiseEffect({
          blendFunction: BlendFunction.OVERLAY,
        });
        noiseEffect.blendMode.opacity.value = noiseIntensity;
        effects.push(noiseEffect);
      }

      // === SMAA Anti-aliasing (final pass) ===
      const smaaEffect = new SMAAEffect({
        preset: SMAAPreset.HIGH,
      });
      effects.push(smaaEffect);

      // Create effect pass with all effects
      if (effects.length > 0) {
        const effectPass = new EffectPass(camera, ...effects);
        composer.addPass(effectPass);
      }

      // Set initial size
      composer.setSize(size.width, size.height);

      composerRef.current = composer;

      console.info('[ManualPostProcessing] Composer initialized with effects:', {
        bloom, vignette, noise, ssao, depthOfField, chromaticAberration,
        colorGrading, godRays, toneMapping,
        effectCount: effects.length,
        width: size.width, 
        height: size.height
      });
    } catch (error) {
      console.error('[ManualPostProcessing] Failed to initialize composer:', error);
    }

    // Cleanup
    return () => {
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
      }
      normalPassRef.current = null;
      if (sunMeshRef.current) {
        scene.remove(sunMeshRef.current);
        sunMeshRef.current.geometry.dispose();
        (sunMeshRef.current.material as THREE.Material).dispose();
        sunMeshRef.current = null;
      }
    };
  }, [
    gl, scene, camera, hasEffects, 
    bloom, bloomIntensity, bloomThreshold, bloomRadius,
    vignette, vignetteIntensity, vignetteOffset,
    noise, noiseIntensity,
    ssao, ssaoIntensity, ssaoRadius, ssaoBias,
    depthOfField, dofFocusDistance, dofFocalLength, dofBokehScale,
    chromaticAberration, chromaticAberrationOffset,
    colorGrading, brightness, contrast, saturation, hue,
    godRays, godRaysIntensity, godRaysDecay, godRaysDensity, sunLight,
    toneMapping,
    size.width, size.height
  ]);

  // Update size when window changes
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size.width, size.height]);

  // Render with composer - ONLY when effects are active
  useFrame((state, delta) => {
    if (!composerRef.current || !hasEffects) return;

    try {
      composerRef.current.render(delta);
    } catch (error) {
      console.error('[ManualPostProcessing] Render error:', error);
      composerRef.current?.dispose();
      composerRef.current = null;
    }
  }, hasEffects ? 1 : 0);

  return null;
};

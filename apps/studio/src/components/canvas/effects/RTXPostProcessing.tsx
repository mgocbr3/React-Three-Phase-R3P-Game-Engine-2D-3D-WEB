/**
 * RTXPostProcessing - Efeitos de pós-processamento RTX-like
 * 
 * Implementação manual de efeitos visuais sem usar @react-three/postprocessing
 * que tem bugs com React 19. Usa shaders customizados e técnicas nativas do Three.js.
 * 
 * Efeitos implementados:
 * - Bloom (brilho em áreas claras)
 * - Vignette (escurecimento nas bordas)
 * - Color Grading (correção de cor cinematográfica)
 * - Film Grain (granulação de filme)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { useEngineSettings } from '@/stores/engineSettingsStore';

// Vignette shader
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vignette = 1.0 - dot(uv, uv);
      texel.rgb *= mix(1.0, vignette, darkness);
      gl_FragColor = texel;
    }
  `,
};

// Color grading shader (Lumen-style cinematic tonemapping + color adjustments)
const ColorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.0 },
    contrast: { value: 1.0 },
    brightness: { value: 0.0 },
    temperature: { value: 0.0 }, // -1 = cool, 1 = warm
    shadows: { value: 0.0 }, // Shadow lift
    highlights: { value: 0.0 }, // Highlight compression
    gamma: { value: 1.0 }, // Gamma correction
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float brightness;
    uniform float temperature;
    uniform float shadows;
    uniform float highlights;
    uniform float gamma;
    varying vec2 vUv;
    
    // Luminance weights (Rec. 709)
    const vec3 luminanceWeights = vec3(0.2126, 0.7152, 0.0722);
    
    // ACES Filmic Tone Mapping (approximation)
    vec3 ACESFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    
    vec3 adjustSaturation(vec3 color, float sat) {
      float gray = dot(color, luminanceWeights);
      return mix(vec3(gray), color, sat);
    }
    
    vec3 adjustTemperature(vec3 color, float temp) {
      // More subtle and realistic temperature shift
      float t = temp * 0.08;
      color.r = color.r + t * (1.0 - color.r * 0.5);
      color.b = color.b - t * (1.0 - color.b * 0.5);
      // Slight green adjustment for realism
      color.g = color.g + t * 0.02;
      return color;
    }
    
    // Lift shadows, compress highlights (like Unreal's color grading)
    vec3 liftGammaGain(vec3 color, float lift, float gamma, float gain) {
      float luma = dot(color, luminanceWeights);
      // Shadows (lift) - affects dark areas more
      color = color + lift * (1.0 - color) * (1.0 - luma);
      // Gamma - midtone adjustment
      color = pow(color, vec3(1.0 / gamma));
      // Highlights (gain) - compress bright areas
      color = color * (1.0 - gain * 0.5) + gain * 0.5 * color * color;
      return color;
    }
    
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;
      
      // Apply lift/gamma/gain (shadow/midtone/highlight control)
      color = liftGammaGain(color, shadows * 0.1, gamma, highlights * 0.1);
      
      // Brightness (exposure-like)
      color = color * (1.0 + brightness);
      
      // Contrast with midpoint preservation
      color = (color - 0.5) * (1.0 + contrast) + 0.5;
      
      // Saturation with luminance preservation
      color = adjustSaturation(color, saturation);
      
      // Temperature
      color = adjustTemperature(color, temperature);
      
      // Final clamp
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
    }
  `,
};

// Film grain shader
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0.0 },
    intensity: { value: 0.05 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;
    
    float random(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float grain = random(vUv + time) * intensity;
      texel.rgb += grain - intensity * 0.5;
      gl_FragColor = texel;
    }
  `,
};

interface RTXPostProcessingProps {
  enabled?: boolean;
  bloom?: boolean;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  vignette?: boolean;
  vignetteIntensity?: number;
  colorGrading?: boolean;
  saturation?: number;
  contrast?: number;
  brightness?: number;
  temperature?: number;
  filmGrain?: boolean;
  filmGrainIntensity?: number;
}

/**
 * RTXPostProcessing - Post-processing effects using Three.js native passes
 * Works with React 19 by avoiding @react-three/postprocessing
 */
export const RTXPostProcessing = ({
  enabled = true,
  bloom = true,
  bloomStrength = 0.5,
  bloomRadius = 0.4,
  bloomThreshold = 0.8,
  vignette = true,
  vignetteIntensity = 0.5,
  colorGrading = true,
  saturation = 1.1,
  contrast = 1.05,
  brightness = 0.0,
  temperature = 0.1,
  filmGrain = false,
  filmGrainIntensity = 0.03,
}: RTXPostProcessingProps) => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const filmGrainPassRef = useRef<ShaderPass | null>(null);
  
  // Create effect composer
  useEffect(() => {
    if (!enabled) {
      composerRef.current = null;
      return;
    }
    
    const composer = new EffectComposer(gl);
    
    // Render pass (renders the scene)
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Bloom pass
    if (bloom) {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(size.width, size.height),
        bloomStrength,
        bloomRadius,
        bloomThreshold
      );
      composer.addPass(bloomPass);
    }
    
    // Color grading pass
    if (colorGrading) {
      const colorPass = new ShaderPass(ColorGradingShader);
      colorPass.uniforms.saturation.value = saturation;
      colorPass.uniforms.contrast.value = contrast;
      colorPass.uniforms.brightness.value = brightness;
      colorPass.uniforms.temperature.value = temperature;
      composer.addPass(colorPass);
    }
    
    // Vignette pass
    if (vignette) {
      const vignettePass = new ShaderPass(VignetteShader);
      vignettePass.uniforms.offset.value = 1.0;
      vignettePass.uniforms.darkness.value = vignetteIntensity;
      composer.addPass(vignettePass);
    }
    
    // Film grain pass
    if (filmGrain) {
      const grainPass = new ShaderPass(FilmGrainShader);
      grainPass.uniforms.intensity.value = filmGrainIntensity;
      filmGrainPassRef.current = grainPass;
      composer.addPass(grainPass);
    }
    
    // Output pass (for correct color space)
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    
    composerRef.current = composer;
    
    return () => {
      composer.dispose();
    };
  }, [
    enabled, gl, scene, camera, size,
    bloom, bloomStrength, bloomRadius, bloomThreshold,
    vignette, vignetteIntensity,
    colorGrading, saturation, contrast, brightness, temperature,
    filmGrain, filmGrainIntensity
  ]);
  
  // Handle resize
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size]);
  
  // Render loop
  useFrame(({ clock }) => {
    if (!composerRef.current || !enabled) return;
    
    // Update film grain time
    if (filmGrainPassRef.current) {
      filmGrainPassRef.current.uniforms.time.value = clock.getElapsedTime();
    }
    
    composerRef.current.render();
  }, 1); // Priority 1 to run after scene updates
  
  return null;
};

/**
 * RTXEffectsWithSettings - Wrapper that uses engine settings store
 */
export const RTXEffectsWithSettings = () => {
  const settings = useEngineSettings();
  
  // Only enable if bloom is explicitly turned on
  const enabled = settings.bloom;
  
  if (!enabled) return null;
  
  return (
    <RTXPostProcessing
      enabled={true}
      bloom={settings.bloom}
      bloomStrength={settings.bloomIntensity}
      bloomRadius={settings.bloomRadius}
      bloomThreshold={settings.bloomThreshold}
      vignette={settings.vignette}
      vignetteIntensity={settings.vignetteIntensity}
      colorGrading={false}
      saturation={1.0}
      contrast={1.0}
      temperature={0.0}
      filmGrain={settings.noise}
      filmGrainIntensity={settings.noiseIntensity}
    />
  );
};

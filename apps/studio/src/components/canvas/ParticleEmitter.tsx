import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Particle preset types
export type ParticlePreset = 'sparkles' | 'fire' | 'smoke' | 'rain' | 'snow' | 'magic' | 'explosion' | 'dust' | 'bubbles' | 'custom';

// ============================================
// PROCEDURAL PARTICLE TEXTURES
// ============================================

// Create soft circular gradient texture for particles
const createSoftCircleTexture = (size = 64): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

// Create fire/flame texture with hot center
const createFireTexture = (size = 64): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Hot core gradient (yellow to orange to transparent)
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 200, 100, 0.9)');
  gradient.addColorStop(0.4, 'rgba(255, 120, 50, 0.7)');
  gradient.addColorStop(0.7, 'rgba(200, 50, 20, 0.3)');
  gradient.addColorStop(1, 'rgba(100, 20, 10, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

// Create smoke texture with soft edges
const createSmokeTexture = (size = 64): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Soft cloudy gradient
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(200, 200, 200, 0.6)');
  gradient.addColorStop(0.3, 'rgba(150, 150, 150, 0.4)');
  gradient.addColorStop(0.6, 'rgba(100, 100, 100, 0.2)');
  gradient.addColorStop(1, 'rgba(80, 80, 80, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

// Create magical sparkle texture with star shape
const createSparkleTexture = (size = 64): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const center = size / 2;
  
  // Draw 4-pointed star
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const outerRadius = size / 2;
    const innerRadius = size / 8;
    
    ctx.lineTo(
      center + Math.cos(angle) * outerRadius,
      center + Math.sin(angle) * outerRadius
    );
    ctx.lineTo(
      center + Math.cos(angle + Math.PI / 4) * innerRadius,
      center + Math.sin(angle + Math.PI / 4) * innerRadius
    );
  }
  ctx.closePath();
  
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 200, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fill();
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

// Texture cache to avoid recreating
const textureCache: Record<string, THREE.Texture> = {};
const getParticleTexture = (type: 'soft' | 'fire' | 'smoke' | 'sparkle'): THREE.Texture => {
  if (!textureCache[type]) {
    switch (type) {
      case 'fire':
        textureCache[type] = createFireTexture();
        break;
      case 'smoke':
        textureCache[type] = createSmokeTexture();
        break;
      case 'sparkle':
        textureCache[type] = createSparkleTexture();
        break;
      default:
        textureCache[type] = createSoftCircleTexture();
    }
  }
  return textureCache[type];
};

export interface ParticleSettings {
  enabled: boolean;
  preset: ParticlePreset;
  count: number;
  size: number;
  sizeVariation: number;
  speed: number;
  lifetime: number;
  spread: number;
  color: string;
  colorEnd?: string;
  opacity: number;
  opacityFade: boolean;
  gravity: number;
  turbulence: number;
  emissionRate: number;
  burst: boolean;
  loop: boolean;
  worldSpace: boolean;
  blending: 'normal' | 'additive' | 'multiply';
  direction: [number, number, number];
  cone: number;
  // NEW: Enhanced visual options
  emissive?: boolean;        // Whether particles emit light
  emissiveIntensity?: number; // How bright the emission is (0-3)
  pointLightIntensity?: number; // Add actual point light (0 = off, costly!)
  textureType?: 'soft' | 'fire' | 'smoke' | 'sparkle'; // Procedural texture
  rotateParticles?: boolean; // Rotate particles over time
  stretchWithVelocity?: boolean; // Stretch particles in movement direction
  sizeOverLifetime?: 'constant' | 'shrink' | 'grow' | 'pulse'; // Size animation
  colorOverLifetime?: boolean; // Animate color from start to end
  trailEnabled?: boolean; // Enable particle trails
  trailLength?: number; // Trail length (1-5)
}

export const getDefaultParticleSettings = (): ParticleSettings => ({
  enabled: false,
  preset: 'sparkles',
  count: 20,
  size: 0.15,
  sizeVariation: 0.5,
  speed: 0.5,
  lifetime: 3,
  spread: 1,
  color: '#ffffff',
  colorEnd: undefined,
  opacity: 1,
  opacityFade: true,
  gravity: 0,
  turbulence: 0.2,
  emissionRate: 5,
  burst: false,
  loop: true,
  worldSpace: false,
  blending: 'additive',
  direction: [0, 1, 0],
  cone: 45,
  // New defaults
  emissive: true,
  emissiveIntensity: 1.5,
  pointLightIntensity: 0,
  textureType: 'soft',
  rotateParticles: false,
  stretchWithVelocity: false,
  sizeOverLifetime: 'constant',
  colorOverLifetime: false,
  trailEnabled: false,
  trailLength: 2,
});

// ENHANCED presets with emissive lighting
export const particlePresets: Record<ParticlePreset, Partial<ParticleSettings>> = {
  sparkles: {
    count: 20,
    size: 0.15,
    speed: 0.4,
    color: '#ffd700',
    colorEnd: '#ffffff',
    opacity: 1,
    turbulence: 0.5,
    blending: 'additive',
    gravity: 0.05,
    lifetime: 3,
    emissive: true,
    emissiveIntensity: 2,
    textureType: 'sparkle',
    rotateParticles: true,
    sizeOverLifetime: 'pulse',
    colorOverLifetime: true,
  },
  fire: {
    count: 40,
    size: 0.25,
    sizeVariation: 0.4,
    speed: 1.2,
    color: '#ff4400',
    colorEnd: '#ffff00',
    opacity: 0.9,
    opacityFade: true,
    gravity: -0.4,
    turbulence: 0.2,
    blending: 'additive',
    direction: [0, 1, 0],
    cone: 30,
    lifetime: 1.5,
    emissive: true,
    emissiveIntensity: 2.5,
    pointLightIntensity: 0.5, // Subtle glow
    textureType: 'fire',
    sizeOverLifetime: 'shrink',
    colorOverLifetime: true,
  },
  smoke: {
    count: 25,
    size: 0.5,
    sizeVariation: 0.3,
    speed: 0.5,
    color: '#666666',
    colorEnd: '#333333',
    opacity: 0.4,
    opacityFade: true,
    gravity: -0.15,
    turbulence: 0.35,
    blending: 'normal',
    spread: 0.4,
    lifetime: 5,
    emissive: false,
    textureType: 'smoke',
    sizeOverLifetime: 'grow',
    colorOverLifetime: true,
  },
  rain: {
    count: 50,
    size: 0.03,
    speed: 4,
    color: '#aaddff',
    opacity: 0.6,
    gravity: 1,
    turbulence: 0.02,
    blending: 'normal',
    direction: [0, -1, 0],
    cone: 3,
    spread: 5,
    lifetime: 1.5,
    emissive: false,
    stretchWithVelocity: true,
  },
  snow: {
    count: 40,
    size: 0.1,
    sizeVariation: 0.5,
    speed: 0.4,
    color: '#ffffff',
    opacity: 0.85,
    gravity: 0.2,
    turbulence: 0.25,
    blending: 'normal',
    direction: [0, -1, 0],
    cone: 20,
    spread: 4,
    lifetime: 6,
    emissive: true,
    emissiveIntensity: 0.3,
    rotateParticles: true,
    sizeOverLifetime: 'pulse',
  },
  magic: {
    count: 30,
    size: 0.18,
    speed: 1,
    color: '#9933ff',
    colorEnd: '#00ffff',
    opacity: 1,
    opacityFade: true,
    gravity: 0,
    turbulence: 0.6,
    blending: 'additive',
    spread: 1.5,
    lifetime: 2,
    emissive: true,
    emissiveIntensity: 3,
    textureType: 'sparkle',
    rotateParticles: true,
    colorOverLifetime: true,
    trailEnabled: true,
    trailLength: 3,
  },
  explosion: {
    count: 50,
    size: 0.3,
    sizeVariation: 0.4,
    speed: 4,
    color: '#ff6600',
    colorEnd: '#ffff00',
    opacity: 1,
    opacityFade: true,
    gravity: 0.3,
    turbulence: 0.15,
    blending: 'additive',
    burst: true,
    loop: false,
    lifetime: 1,
    cone: 180,
    emissive: true,
    emissiveIntensity: 3,
    pointLightIntensity: 2,
    textureType: 'fire',
    sizeOverLifetime: 'shrink',
    colorOverLifetime: true,
  },
  dust: {
    count: 30,
    size: 0.06,
    sizeVariation: 0.5,
    speed: 0.15,
    color: '#d4a574',
    colorEnd: '#a08060',
    opacity: 0.3,
    gravity: 0.03,
    turbulence: 0.5,
    blending: 'normal',
    spread: 3,
    lifetime: 8,
    emissive: false,
    textureType: 'soft',
    rotateParticles: true,
  },
  bubbles: {
    count: 15,
    size: 0.15,
    sizeVariation: 0.6,
    speed: 0.4,
    color: '#aaeeff',
    colorEnd: '#ffffff',
    opacity: 0.5,
    gravity: -0.3,
    turbulence: 0.2,
    blending: 'normal',
    direction: [0, 1, 0],
    cone: 25,
    lifetime: 4,
    emissive: true,
    emissiveIntensity: 0.5,
    sizeOverLifetime: 'grow',
  },
  custom: {},
};

export const applyParticlePreset = (preset: ParticlePreset, current: ParticleSettings): ParticleSettings => {
  const presetSettings = particlePresets[preset];
  return {
    ...getDefaultParticleSettings(),
    ...presetSettings,
    preset,
    enabled: current.enabled,
  };
};

interface ParticleEmitterProps {
  settings: ParticleSettings;
  position?: [number, number, number];
  scale?: [number, number, number];
}

// Emissive particle shader for glow effects
const emissiveParticleVertexShader = `
  attribute float size;
  attribute float alpha;
  attribute float rotation;
  attribute float age;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;
  varying float vAge;
  
  uniform float uTime;
  uniform float uEmissiveIntensity;
  uniform float uSizeMultiplier;
  
  void main() {
    vColor = color;
    vAlpha = alpha;
    vRotation = rotation;
    vAge = age;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Size animation based on age
    float sizeAnim = size * uSizeMultiplier;
    
    gl_PointSize = sizeAnim * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const emissiveParticleFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uEmissiveIntensity;
  uniform vec3 uEmissiveColor;
  uniform bool uColorOverLifetime;
  uniform vec3 uColorEnd;
  uniform int uTextureType;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;
  varying float vAge;
  
  void main() {
    vec2 uv = gl_PointCoord;
    
    // Apply rotation
    if (vRotation != 0.0) {
      float c = cos(vRotation);
      float s = sin(vRotation);
      uv -= 0.5;
      uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
      uv += 0.5;
    }
    
    vec4 texColor = texture2D(uTexture, uv);
    
    // Color interpolation over lifetime
    vec3 finalColor = vColor;
    if (uColorOverLifetime) {
      finalColor = mix(uColorEnd, vColor, vAge);
    }
    
    // Apply emissive glow
    vec3 emissive = finalColor * uEmissiveIntensity;
    
    // HDR-like bloom effect (brighter cores)
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    emissive += finalColor * pow(luminance, 2.0) * uEmissiveIntensity * 0.5;
    
    gl_FragColor = vec4(emissive, texColor.a * vAlpha);
    
    // Discard fully transparent pixels
    if (gl_FragColor.a < 0.01) discard;
  }
`;

// Dynamic point light for emissive particles
const ParticlePointLight = ({ 
  color, 
  intensity, 
  position: lightPos 
}: { 
  color: string; 
  intensity: number; 
  position: [number, number, number];
}) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const baseIntensity = intensity;
  
  useFrame((state) => {
    if (lightRef.current) {
      // Flickering effect
      const flicker = Math.sin(state.clock.elapsedTime * 8) * 0.15 + 
                      Math.sin(state.clock.elapsedTime * 13) * 0.1;
      lightRef.current.intensity = baseIntensity * (1 + flicker);
    }
  });
  
  return (
    <pointLight
      ref={lightRef}
      color={color}
      intensity={intensity}
      distance={4}
      decay={2}
      position={lightPos}
      castShadow={false}
    />
  );
};

// Enhanced particle system with emissive lighting
const LightParticleSystem = ({ settings, position = [0, 0, 0], scale = [1, 1, 1] }: ParticleEmitterProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const dataRef = useRef<{
    velocities: Float32Array;
    lifetimes: Float32Array;
    maxLifetimes: Float32Array;
    initPos: Float32Array;
    sizes: Float32Array;
    rotations: Float32Array;
  } | null>(null);
  const frameSkip = useRef(0);

  // Hard cap at 100 particles for stability
  const count = Math.min(Math.max(1, settings.count), 100);
  
  // Get texture based on settings
  const texture = useMemo(() => {
    return getParticleTexture(settings.textureType || 'soft');
  }, [settings.textureType]);

  const { geometry, baseColor, colorEnd } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const maxLifetimes = new Float32Array(count);
    const initPos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const rotations = new Float32Array(count);
    const ages = new Float32Array(count);

    const color1 = new THREE.Color(settings.color);
    const color2 = settings.colorEnd ? new THREE.Color(settings.colorEnd) : color1;

    // Safe direction
    const dir = new THREE.Vector3(...settings.direction);
    if (dir.lengthSq() < 0.001) dir.set(0, 1, 0);
    dir.normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const quat = Math.abs(dir.dot(up)) > 0.99
      ? new THREE.Quaternion()
      : new THREE.Quaternion().setFromUnitVectors(up, dir);

    const coneRad = (settings.cone * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      const sx = (Math.random() - 0.5) * settings.spread;
      const sy = (Math.random() - 0.5) * settings.spread;
      const sz = (Math.random() - 0.5) * settings.spread;

      positions[i * 3] = sx;
      positions[i * 3 + 1] = sy;
      positions[i * 3 + 2] = sz;
      initPos[i * 3] = sx;
      initPos[i * 3 + 1] = sy;
      initPos[i * 3 + 2] = sz;

      // Velocity in cone
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * coneRad;
      const spd = settings.speed * (0.6 + Math.random() * 0.4);

      const v = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).applyQuaternion(quat);

      velocities[i * 3] = v.x * spd;
      velocities[i * 3 + 1] = v.y * spd;
      velocities[i * 3 + 2] = v.z * spd;

      // Color blend
      const t = Math.random();
      const c = color1.clone().lerp(color2, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      // Stagger lifetimes
      const lifetime = settings.burst ? settings.lifetime : Math.random() * settings.lifetime;
      lifetimes[i] = lifetime;
      maxLifetimes[i] = settings.lifetime;
      
      // Size with variation
      const sizeVar = settings.sizeVariation || 0;
      sizes[i] = settings.size * (1 + (Math.random() - 0.5) * sizeVar);
      
      // Initial opacity
      alphas[i] = settings.opacity;
      
      // Random rotation for rotating particles
      rotations[i] = settings.rotateParticles ? Math.random() * Math.PI * 2 : 0;
      
      // Age starts at 1 (full life)
      ages[i] = lifetime / settings.lifetime;
    }

    dataRef.current = { velocities, lifetimes, maxLifetimes, initPos, sizes, rotations };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
    geo.setAttribute('age', new THREE.BufferAttribute(ages, 1));

    return { geometry: geo, baseColor: color1, colorEnd: color2 };
  }, [count, settings.color, settings.colorEnd, settings.spread, settings.speed, settings.direction, settings.cone, settings.lifetime, settings.burst, settings.size, settings.sizeVariation, settings.opacity, settings.rotateParticles]);

  // Shader uniforms
  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uTime: { value: 0 },
    uEmissiveIntensity: { value: settings.emissive ? (settings.emissiveIntensity || 1.5) : 1.0 },
    uEmissiveColor: { value: baseColor },
    uColorOverLifetime: { value: settings.colorOverLifetime || false },
    uColorEnd: { value: colorEnd },
    uSizeMultiplier: { value: 1.0 },
    uTextureType: { value: settings.textureType === 'fire' ? 1 : settings.textureType === 'smoke' ? 2 : settings.textureType === 'sparkle' ? 3 : 0 },
  }), [texture, settings.emissive, settings.emissiveIntensity, settings.colorOverLifetime, baseColor, colorEnd, settings.textureType]);

  // Update loop
  useFrame((state, delta) => {
    frameSkip.current++;
    if (frameSkip.current < 2) return;
    frameSkip.current = 0;

    if (!pointsRef.current || !dataRef.current) return;

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const sizeAttr = pointsRef.current.geometry.attributes.size as THREE.BufferAttribute;
    const alphaAttr = pointsRef.current.geometry.attributes.alpha as THREE.BufferAttribute;
    const rotationAttr = pointsRef.current.geometry.attributes.rotation as THREE.BufferAttribute;
    const ageAttr = pointsRef.current.geometry.attributes.age as THREE.BufferAttribute;
    
    if (!posAttr || !sizeAttr || !alphaAttr) return;

    const pos = posAttr.array as Float32Array;
    const sizeArr = sizeAttr.array as Float32Array;
    const alphaArr = alphaAttr.array as Float32Array;
    const rotArr = rotationAttr.array as Float32Array;
    const ageArr = ageAttr.array as Float32Array;
    
    const { velocities, lifetimes, maxLifetimes, initPos, sizes, rotations } = dataRef.current;
    const grav = settings.gravity * delta * 2 * 10;
    const turb = settings.turbulence * delta * 2;
    const dt = delta * 2;

    for (let i = 0; i < count; i++) {
      lifetimes[i] -= dt;
      const age = Math.max(0, lifetimes[i] / maxLifetimes[i]);
      ageArr[i] = age;

      if (lifetimes[i] <= 0) {
        if (settings.loop) {
          pos[i * 3] = initPos[i * 3] + (Math.random() - 0.5) * settings.spread * 0.3;
          pos[i * 3 + 1] = initPos[i * 3 + 1] + (Math.random() - 0.5) * settings.spread * 0.3;
          pos[i * 3 + 2] = initPos[i * 3 + 2] + (Math.random() - 0.5) * settings.spread * 0.3;
          lifetimes[i] = maxLifetimes[i];
          alphaArr[i] = settings.opacity;
          sizeArr[i] = sizes[i];
          rotations[i] = settings.rotateParticles ? Math.random() * Math.PI * 2 : 0;
        } else {
          pos[i * 3] = 9999;
          pos[i * 3 + 1] = 9999;
          pos[i * 3 + 2] = 9999;
          alphaArr[i] = 0;
        }
        continue;
      }

      // Position update
      pos[i * 3] += velocities[i * 3] * dt;
      pos[i * 3 + 1] += velocities[i * 3 + 1] * dt - grav;
      pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;

      // Turbulence
      if (turb > 0) {
        pos[i * 3] += (Math.random() - 0.5) * turb;
        pos[i * 3 + 1] += (Math.random() - 0.5) * turb;
        pos[i * 3 + 2] += (Math.random() - 0.5) * turb;
      }

      // Size over lifetime
      let sizeMult = 1.0;
      switch (settings.sizeOverLifetime) {
        case 'shrink':
          sizeMult = age;
          break;
        case 'grow':
          sizeMult = 1 - age * 0.5;
          break;
        case 'pulse':
          sizeMult = 0.7 + Math.sin(age * Math.PI * 3) * 0.3;
          break;
        default:
          sizeMult = 1.0;
      }
      sizeArr[i] = sizes[i] * sizeMult;

      // Opacity fade
      if (settings.opacityFade) {
        alphaArr[i] = settings.opacity * age;
      }

      // Rotation update
      if (settings.rotateParticles) {
        rotArr[i] += dt * (0.5 + Math.random() * 0.5);
      }
    }

    // Update shader uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    rotationAttr.needsUpdate = true;
    ageAttr.needsUpdate = true;
  });

  const blending = settings.blending === 'additive' ? THREE.AdditiveBlending
    : settings.blending === 'multiply' ? THREE.MultiplyBlending
    : THREE.NormalBlending;

  // Render with or without emissive shader
  const useEmissiveShader = settings.emissive && (settings.emissiveIntensity || 1) > 1;
  
  return (
    <group position={position} scale={scale}>
      {/* Main particle points */}
      <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
        {useEmissiveShader ? (
          <shaderMaterial
            ref={materialRef}
            vertexShader={emissiveParticleVertexShader}
            fragmentShader={emissiveParticleFragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={blending}
            vertexColors
          />
        ) : (
          <pointsMaterial
            transparent
            vertexColors
            map={texture}
            size={Math.max(0.02, settings.size) * 3}
            sizeAttenuation
            depthWrite={false}
            blending={blending}
            opacity={settings.opacity}
          />
        )}
      </points>
      
      {/* Dynamic point light for truly emissive particles */}
      {settings.pointLightIntensity && settings.pointLightIntensity > 0 && (
        <ParticlePointLight
          color={settings.color}
          intensity={settings.pointLightIntensity}
          position={[0, 0.5, 0]}
        />
      )}
    </group>
  );
};

export const ParticleEmitter = ({ settings, position, scale }: ParticleEmitterProps) => {
  if (!settings.enabled) return null;
  return <LightParticleSystem settings={settings} position={position} scale={scale} />;
};

export default ParticleEmitter;

import { useEffect, useRef, useMemo } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { TrimeshCollider, RigidBody, RapierRigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { shaderMaterial } from '@react-three/drei';
import { TerrainBiome } from '@/stores/terrainStore';

interface TerrainGeneratorProps {
  seed?: number;
  scale?: number;
  height?: number;
  waterLevel?: number;
  segmentsX?: number;
  segmentsY?: number;
  showVegetation?: boolean;
  vegetationDensity?: number;
  enableCollision?: boolean;
  terrainSize?: number;
  // Water settings
  waterColor?: string;
  waterDeepColor?: string;
  waveHeight?: number;
  waveSpeed?: number;
  waterOpacity?: number;
  foamIntensity?: number;
  // Biome settings
  biome?: TerrainBiome;
  erosionStrength?: number;
  flatness?: number;
  mountainousness?: number;
  coastalBlend?: number;
}

// Simple deterministic RNG
const createSeededRandom = (seed: number) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

// ============================================
// STYLIZED GRASS SHADER (Zelda BOTW style)
// ============================================
const GrassMaterial = shaderMaterial(
  {
    uTime: 0,
    uWindStrength: 0.4,
    uWindFrequency: 1.2,
    uGrassColorTop: new THREE.Color(0x7cba3d),
    uGrassColorBottom: new THREE.Color(0x3d6b1a),
    uGrassColorDry: new THREE.Color(0xa8c256),
  },
  // Vertex shader - wind animation
  `
    uniform float uTime;
    uniform float uWindStrength;
    uniform float uWindFrequency;
    
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    
    void main() {
      vNormal = normalMatrix * normal;
      
      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vHeight = position.y;
      
      vec3 pos = position;
      
      // Wind effect using world position for continuity
      float windPhase = worldPos.x * 0.1 + worldPos.z * 0.15 + uTime * uWindFrequency;
      float windEffect = sin(windPhase) * uWindStrength;
      float windEffect2 = cos(windPhase * 0.7 + 1.5) * uWindStrength * 0.5;
      
      // Apply wind more at top of blade
      float heightFactor = smoothstep(0.0, 1.0, pos.y);
      pos.x += windEffect * heightFactor;
      pos.z += windEffect2 * heightFactor;
      
      // Natural bend
      pos.x += pos.y * pos.y * 0.15;
      
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment shader
  `
    uniform vec3 uGrassColorTop;
    uniform vec3 uGrassColorBottom;
    uniform vec3 uGrassColorDry;
    uniform float uTime;
    
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    
    void main() {
      // Height gradient
      float heightFactor = smoothstep(0.0, 0.7, vHeight);
      vec3 baseColor = mix(uGrassColorBottom, uGrassColorTop, heightFactor);
      
      // Add variation based on world position
      float variation = sin(vWorldPos.x * 0.5) * cos(vWorldPos.z * 0.5) * 0.5 + 0.5;
      vec3 finalColor = mix(baseColor, uGrassColorDry, variation * 0.25);
      
      // Simple lighting
      vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
      float diffuse = max(dot(vNormal, lightDir), 0.0);
      float ambient = 0.4;
      finalColor *= (ambient + diffuse * 0.6);
      
      // Ambient occlusion at base
      float ao = mix(0.6, 1.0, heightFactor);
      finalColor *= ao;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ GrassMaterial });

// ============================================
// ULTRA-REALISTIC WATER SHADER
// ============================================
const RealisticWaterMaterial = shaderMaterial(
  {
    uTime: 0,
    uShallowColor: new THREE.Color(0x1ca3ec),
    uDeepColor: new THREE.Color(0x0c2d4a),
    uFoamColor: new THREE.Color(0xffffff),
    uSunDirection: new THREE.Vector3(0.5, 0.8, 0.3),
    uSunColor: new THREE.Color(0xffffcc),
    uWaveHeight: 0.8,
    uWaveSpeed: 1.0,
    uFresnelPower: 4.0,
    uReflectivity: 0.6,
    uWaterClarity: 0.4,
    uFoamIntensity: 0.5,
    uCausticScale: 8.0,
    uCausticIntensity: 0.15,
    uRippleScale: 40.0,
    uTerrainSize: 100.0,
    uFogColor: new THREE.Color(0xc8dde8),
  },
  // Vertex shader with Gerstner waves
  `
    uniform float uTime;
    uniform float uWaveHeight;
    uniform float uWaveSpeed;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewDirection;
    varying float vFoamFactor;
    varying float vWaveHeight;
    
    vec3 gerstnerWave(vec2 coord, float steepness, float wavelength, vec2 direction, float time) {
      float k = 2.0 * 3.14159 / wavelength;
      float c = sqrt(9.8 / k);
      vec2 d = normalize(direction);
      float f = k * (dot(d, coord) - c * time);
      float a = steepness / k;
      
      return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
    }
    
    void main() {
      vUv = uv;
      vec3 pos = position;
      
      float t = uTime * uWaveSpeed;
      
      vec3 wave1 = gerstnerWave(pos.xz, 0.15, 60.0, vec2(1.0, 0.3), t * 0.8);
      vec3 wave2 = gerstnerWave(pos.xz, 0.12, 40.0, vec2(-0.7, 0.6), t * 1.0);
      vec3 wave3 = gerstnerWave(pos.xz, 0.08, 20.0, vec2(0.4, -0.8), t * 1.4);
      vec3 wave4 = gerstnerWave(pos.xz, 0.04, 8.0, vec2(-0.5, 0.5), t * 2.0);
      vec3 wave5 = gerstnerWave(pos.xz, 0.03, 5.0, vec2(0.8, 0.2), t * 2.5);
      
      vec3 totalWave = (wave1 + wave2 + wave3 + wave4 + wave5) * uWaveHeight;
      pos += totalWave;
      
      vWaveHeight = totalWave.y;
      vFoamFactor = smoothstep(0.3 * uWaveHeight, 0.8 * uWaveHeight, totalWave.y);
      
      float eps = 0.1;
      vec3 wave1X = gerstnerWave(pos.xz + vec2(eps, 0.0), 0.15, 60.0, vec2(1.0, 0.3), t * 0.8);
      vec3 wave1Z = gerstnerWave(pos.xz + vec2(0.0, eps), 0.15, 60.0, vec2(1.0, 0.3), t * 0.8);
      
      vec3 tangent = normalize(vec3(eps, (wave1X.y - wave1.y) * uWaveHeight, 0.0));
      vec3 bitangent = normalize(vec3(0.0, (wave1Z.y - wave1.y) * uWaveHeight, eps));
      vNormal = normalize(cross(bitangent, tangent));
      
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      vViewDirection = normalize(cameraPosition - vWorldPosition);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform float uTime;
    uniform vec3 uShallowColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFoamColor;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform float uFresnelPower;
    uniform float uReflectivity;
    uniform float uWaterClarity;
    uniform float uFoamIntensity;
    uniform float uCausticScale;
    uniform float uCausticIntensity;
    uniform float uRippleScale;
    uniform float uTerrainSize;
    uniform vec3 uFogColor;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewDirection;
    varying float vFoamFactor;
    varying float vWaveHeight;
    
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    float caustic(vec2 uv, float time) {
      float c1 = snoise(uv * uCausticScale + time * 0.5);
      float c2 = snoise(uv * uCausticScale * 1.5 - time * 0.3);
      float c3 = snoise(uv * uCausticScale * 2.0 + time * 0.2);
      return pow(abs(c1 * c2 * c3), 0.5) * uCausticIntensity;
    }
    
    float fresnel(vec3 viewDir, vec3 normal, float power) {
      return pow(1.0 - max(dot(viewDir, normal), 0.0), power);
    }
    
    float specular(vec3 viewDir, vec3 lightDir, vec3 normal, float shininess) {
      vec3 halfDir = normalize(lightDir + viewDir);
      return pow(max(dot(normal, halfDir), 0.0), shininess);
    }
    
    vec3 rippleNormal(vec2 uv, float time) {
      float n1 = snoise(uv * uRippleScale + time * 0.8);
      float n2 = snoise(uv * uRippleScale * 0.7 - time * 0.6);
      return normalize(vec3(n1 * 0.1, 1.0, n2 * 0.1));
    }
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewDirection);
      vec3 sunDir = normalize(uSunDirection);
      
      vec3 ripples = rippleNormal(vUv, uTime);
      normal = normalize(normal + ripples * 0.3);
      
      float fresnelFactor = fresnel(viewDir, normal, uFresnelPower);
      
      float depthFactor = 1.0 - clamp(vWaveHeight * 0.5 + 0.5, 0.0, 1.0);
      vec3 waterColor = mix(uShallowColor, uDeepColor, depthFactor * uWaterClarity);
      
      vec3 reflectDir = reflect(-viewDir, normal);
      float skyGradient = reflectDir.y * 0.5 + 0.5;
      vec3 skyColor = mix(vec3(0.6, 0.75, 0.9), vec3(0.3, 0.5, 0.85), pow(skyGradient, 0.8));
      
      float sunReflection = pow(max(dot(reflectDir, sunDir), 0.0), 128.0);
      skyColor += uSunColor * sunReflection * 2.0;
      
      vec3 color = mix(waterColor, skyColor, fresnelFactor * uReflectivity);
      
      float spec = specular(viewDir, sunDir, normal, 256.0);
      color += uSunColor * spec * 0.8;
      
      float sss = pow(max(dot(-viewDir, sunDir), 0.0), 4.0) * 0.3;
      color += vec3(0.0, 0.4, 0.3) * sss;
      
      float causticPattern = caustic(vWorldPosition.xz * 0.1, uTime);
      color += vec3(causticPattern) * (1.0 - fresnelFactor);
      
      float foam = vFoamFactor * uFoamIntensity;
      float foamNoise = snoise(vWorldPosition.xz * 3.0 + uTime * 0.5) * 0.5 + 0.5;
      foam *= foamNoise;
      color = mix(color, uFoamColor, foam);
      
      float edgeDist = max(abs(vWorldPosition.x), abs(vWorldPosition.z));
      float fadeStart = uTerrainSize * 1.2;
      float fadeEnd = uTerrainSize * 1.8;
      float edgeFade = 1.0 - smoothstep(fadeStart, fadeEnd, edgeDist);
      
      color = mix(uFogColor, color, edgeFade);
      
      float alpha = mix(0.75, 0.95, depthFactor);
      alpha = mix(alpha, 1.0, foam);
      alpha *= edgeFade;
      
      gl_FragColor = vec4(color, alpha);
    }
  `
);

extend({ RealisticWaterMaterial });

// Declare JSX types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      realisticWaterMaterial: any;
      grassMaterial: any;
    }
  }
}

// ============================================
// VEGETATION GEOMETRIES
// ============================================

// Pine tree (alpine biome)
const createPineGeometry = () => {
  const geo = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Trunk
  const trunkRadius = 0.08;
  const trunkHeight = 0.8;
  const trunkSegments = 6;
  
  for (let i = 0; i <= trunkSegments; i++) {
    const angle = (i / trunkSegments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * trunkRadius, 0, Math.sin(angle) * trunkRadius);
    vertices.push(Math.cos(angle) * trunkRadius * 0.7, trunkHeight, Math.sin(angle) * trunkRadius * 0.7);
  }
  
  for (let i = 0; i < trunkSegments; i++) {
    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const i2 = (i + 1) * 2;
    const i3 = (i + 1) * 2 + 1;
    indices.push(i0, i1, i2, i1, i3, i2);
  }
  
  // Pine needle layers (cones)
  const layers = 4;
  const baseIdx = vertices.length / 3;
  
  for (let layer = 0; layer < layers; layer++) {
    const y = trunkHeight + layer * 0.5;
    const radius = 0.7 - layer * 0.15;
    const tipY = y + 0.6;
    
    // Base circle
    for (let i = 0; i <= 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      vertices.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }
    // Tip
    vertices.push(0, tipY, 0);
    
    // Indices for cone
    const layerBase = baseIdx + layer * 10;
    for (let i = 0; i < 8; i++) {
      indices.push(layerBase + i, layerBase + 9, layerBase + i + 1);
    }
  }
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
};

// Deciduous tree (temperate biome)
const createTreeGeometry = () => {
  const geo = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Trunk
  const segments = 6;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * 0.1, 0, Math.sin(angle) * 0.1);
    vertices.push(Math.cos(angle) * 0.08, 1.2, Math.sin(angle) * 0.08);
  }
  
  for (let i = 0; i < segments; i++) {
    const i0 = i * 2;
    indices.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
  }
  
  // Foliage (icosahedron-like clusters)
  const baseIdx = vertices.length / 3;
  const foliagePositions = [
    { x: 0, y: 2.0, z: 0, r: 0.8 },
    { x: 0.3, y: 1.6, z: 0.2, r: 0.5 },
    { x: -0.25, y: 1.7, z: -0.15, r: 0.45 },
    { x: 0.15, y: 2.3, z: -0.2, r: 0.4 },
  ];
  
  foliagePositions.forEach((pos, fi) => {
    const start = baseIdx + fi * 12;
    // Simple sphere approximation with 12 vertices
    const phi = (1 + Math.sqrt(5)) / 2;
    const verts = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ];
    verts.forEach(v => {
      const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      vertices.push(
        pos.x + (v[0] / len) * pos.r,
        pos.y + (v[1] / len) * pos.r,
        pos.z + (v[2] / len) * pos.r
      );
    });
    
    // Faces
    const faces = [
      [0,11,5], [0,5,1], [0,1,7], [0,7,10], [0,10,11],
      [1,5,9], [5,11,4], [11,10,2], [10,7,6], [7,1,8],
      [3,9,4], [3,4,2], [3,2,6], [3,6,8], [3,8,9],
      [4,9,5], [2,4,11], [6,2,10], [8,6,7], [9,8,1],
    ];
    faces.forEach(f => {
      indices.push(start + f[0], start + f[1], start + f[2]);
    });
  });
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
};

// Palm tree (tropical/island biome)
const createPalmGeometry = () => {
  const geo = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Curved trunk
  const trunkSegments = 8;
  const trunkHeight = 2.5;
  
  for (let i = 0; i <= trunkSegments; i++) {
    const t = i / trunkSegments;
    const y = t * trunkHeight;
    const radius = 0.1 - t * 0.04;
    const curve = Math.sin(t * Math.PI * 0.5) * 0.3;
    
    for (let j = 0; j <= 6; j++) {
      const angle = (j / 6) * Math.PI * 2;
      vertices.push(
        Math.cos(angle) * radius + curve,
        y,
        Math.sin(angle) * radius
      );
    }
  }
  
  for (let i = 0; i < trunkSegments; i++) {
    for (let j = 0; j < 6; j++) {
      const i0 = i * 7 + j;
      const i1 = i * 7 + j + 1;
      const i2 = (i + 1) * 7 + j;
      const i3 = (i + 1) * 7 + j + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }
  
  // Palm fronds
  const frondBase = vertices.length / 3;
  const topX = Math.sin(Math.PI * 0.5) * 0.3;
  const frondCount = 7;
  
  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2;
    const frondStart = frondBase + f * 4;
    
    // Frond as elongated triangle
    vertices.push(topX, trunkHeight, 0); // base
    vertices.push(
      topX + Math.cos(angle) * 1.5,
      trunkHeight + 0.5 - Math.abs(Math.sin(angle)) * 0.3,
      Math.sin(angle) * 1.5
    );
    vertices.push(
      topX + Math.cos(angle) * 0.8,
      trunkHeight + 0.3,
      Math.sin(angle) * 0.8
    );
    vertices.push(
      topX + Math.cos(angle) * 0.5,
      trunkHeight + 0.15,
      Math.sin(angle) * 0.5
    );
    
    indices.push(frondStart, frondStart + 1, frondStart + 2);
    indices.push(frondStart, frondStart + 2, frondStart + 3);
  }
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
};

// Cactus (desert biome)
const createCactusGeometry = () => {
  const geo = new THREE.CylinderGeometry(0.15, 0.18, 1.2, 8);
  
  // Add arms using manual vertex manipulation would be complex
  // Using simple cylinder for now, will be scaled
  return geo;
};

// Bush
const createBushGeometry = () => {
  const geo = new THREE.IcosahedronGeometry(0.4, 1);
  
  // Flatten slightly
  const positions = geo.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    positions.setY(i, y * 0.6 + 0.2);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
};

// Rock with natural variation
const createRockGeometry = () => {
  const geo = new THREE.DodecahedronGeometry(0.4, 0);
  
  const positions = geo.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    const noise = Math.sin(x * 10) * Math.cos(z * 10) * 0.1;
    positions.setXYZ(i, x * (1 + noise), y * 0.7, z * (1 + noise));
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
};

// Grass blade
const createGrassBladeGeometry = () => {
  const geo = new THREE.BufferGeometry();
  
  const vertices = new Float32Array([
    -0.03, 0, 0,
    0.03, 0, 0,
    0.02, 0.4, 0,
    -0.02, 0.4, 0,
    0.01, 0.7, 0,
    -0.01, 0.7, 0,
    0, 0.9, 0,
  ]);
  
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    3, 2, 4, 3, 4, 5,
    5, 4, 6,
  ]);
  
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]);
  
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  
  return geo;
};

// ============================================
// MAIN TERRAIN GENERATOR COMPONENT
// ============================================

export const TerrainGenerator = ({
  seed = 42,
  scale = 0.02,
  height = 30,
  waterLevel = 2,
  segmentsX = 128,
  segmentsY = 128,
  showVegetation = true,
  vegetationDensity = 0.3,
  enableCollision = true,
  terrainSize = 200,
  waterColor = '#1ca3ec',
  waterDeepColor = '#0c2d4a',
  waveHeight = 0.8,
  waveSpeed = 1.0,
  waterOpacity = 0.85,
  foamIntensity = 0.5,
  biome = 'temperate' as TerrainBiome,
  erosionStrength = 0.5,
  flatness = 0.4,
  mountainousness = 0.5,
  coastalBlend = 0.3,
}: TerrainGeneratorProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  
  // Vegetation refs
  const instancedTreesRef = useRef<THREE.InstancedMesh>(null);
  const instancedPinesRef = useRef<THREE.InstancedMesh>(null);
  const instancedPalmsRef = useRef<THREE.InstancedMesh>(null);
  const instancedCactusRef = useRef<THREE.InstancedMesh>(null);
  const instancedBushesRef = useRef<THREE.InstancedMesh>(null);
  const instancedRocksRef = useRef<THREE.InstancedMesh>(null);
  const instancedGrassRef = useRef<THREE.InstancedMesh>(null);
  const grassMaterialRef = useRef<any>(null);

  // Create vegetation geometries
  const vegetationGeometries = useMemo(() => ({
    pine: createPineGeometry(),
    tree: createTreeGeometry(),
    palm: createPalmGeometry(),
    cactus: createCactusGeometry(),
    rock: createRockGeometry(),
    bush: createBushGeometry(),
    grass: createGrassBladeGeometry(),
  }), []);

  // Water material
  const waterMaterial = useMemo(() => {
    const mat = new RealisticWaterMaterial();
    mat.transparent = true;
    mat.side = THREE.DoubleSide;
    mat.depthWrite = false;
    return mat;
  }, []);

  useEffect(() => {
    if (waterMaterial) {
      waterMaterial.uShallowColor = new THREE.Color(waterColor);
      waterMaterial.uDeepColor = new THREE.Color(waterDeepColor);
      waterMaterial.uWaveHeight = waveHeight;
      waterMaterial.uWaveSpeed = waveSpeed;
      waterMaterial.uFoamIntensity = foamIntensity;
      waterMaterial.uTerrainSize = terrainSize;
    }
  }, [waterMaterial, waterColor, waterDeepColor, waveHeight, waveSpeed, foamIntensity, terrainSize]);

  // Noise generators
  const noiseGenerators = useMemo(() => {
    const rng = createSeededRandom(seed);
    return {
      continental: createNoise2D(() => rng()),
      mountain: createNoise2D(() => rng()),
      hills: createNoise2D(() => rng()),
      detail: createNoise2D(() => rng()),
      ridge: createNoise2D(() => rng()),
      warpX: createNoise2D(() => rng()),
      warpY: createNoise2D(() => rng()),
      erosion: createNoise2D(() => rng()),
      vegetation: createNoise2D(() => rng()),
      grass: createNoise2D(() => rng()),
      rocks: createNoise2D(() => rng()),
    };
  }, [seed]);

  // Biome configuration
  const biomeConfig = useMemo(() => {
    const configs = {
      tropical: {
        baseColor: { 
          sand: [0.96, 0.89, 0.72], 
          grass: [0.18, 0.58, 0.25], 
          rock: [0.42, 0.38, 0.32], 
          snow: [0.42, 0.40, 0.38] 
        },
        grassColor: { top: '#7cba3d', bottom: '#3d7b1a', dry: '#8bc34a' },
        heightMultiplier: 0.6,
        islandFactor: 0.8,
        vegetationTypes: ['palm', 'bush'],
        treeColor: 0x228b22,
        rockColor: 0x6b5b4f,
        grassDensity: 0.8,
        rockDensity: 0.2,
      },
      temperate: {
        baseColor: { 
          sand: [0.78, 0.72, 0.55], 
          grass: [0.28, 0.52, 0.18], 
          rock: [0.48, 0.45, 0.42], 
          snow: [0.96, 0.96, 1.0] 
        },
        grassColor: { top: '#6baa2e', bottom: '#2d5a12', dry: '#a8c256' },
        heightMultiplier: 1.0,
        islandFactor: 0.2,
        vegetationTypes: ['tree', 'bush'],
        treeColor: 0x2d6b2d,
        rockColor: 0x7a7a7a,
        grassDensity: 1.0,
        rockDensity: 0.3,
      },
      alpine: {
        baseColor: { 
          sand: [0.62, 0.58, 0.52], 
          grass: [0.38, 0.48, 0.32], 
          rock: [0.52, 0.50, 0.48], 
          snow: [0.98, 0.98, 1.0] 
        },
        grassColor: { top: '#5a9a3a', bottom: '#3a5a2a', dry: '#7a9a5a' },
        heightMultiplier: 1.5,
        islandFactor: 0.1,
        vegetationTypes: ['pine', 'rock'],
        treeColor: 0x1a4d1a,
        rockColor: 0x5a5a5a,
        grassDensity: 0.4,
        rockDensity: 0.6,
      },
      desert: {
        baseColor: { 
          sand: [0.94, 0.82, 0.58], 
          grass: [0.72, 0.62, 0.42], 
          rock: [0.68, 0.52, 0.38], 
          snow: [0.82, 0.72, 0.58] 
        },
        grassColor: { top: '#9a8a3a', bottom: '#5a4a2a', dry: '#b8a848' },
        heightMultiplier: 0.5,
        islandFactor: 0.0,
        vegetationTypes: ['cactus', 'rock'],
        treeColor: 0x4a6b2a,
        rockColor: 0x8a6a4a,
        grassDensity: 0.08,
        rockDensity: 0.5,
      },
      island: {
        baseColor: { 
          sand: [0.98, 0.94, 0.78], 
          grass: [0.22, 0.62, 0.28], 
          rock: [0.48, 0.42, 0.38], 
          snow: [0.48, 0.46, 0.42] 
        },
        grassColor: { top: '#7cc83d', bottom: '#3d7b1a', dry: '#9bc356' },
        heightMultiplier: 0.4,
        islandFactor: 1.0,
        vegetationTypes: ['palm', 'bush'],
        treeColor: 0x2a8b2a,
        rockColor: 0x6a5a4a,
        grassDensity: 0.9,
        rockDensity: 0.15,
      },
      canyon: {
        baseColor: { 
          sand: [0.82, 0.58, 0.38], 
          grass: [0.58, 0.48, 0.32], 
          rock: [0.72, 0.48, 0.32], 
          snow: [0.78, 0.52, 0.38] 
        },
        grassColor: { top: '#8a7a4a', bottom: '#4a3a2a', dry: '#a89858' },
        heightMultiplier: 1.2,
        islandFactor: 0.0,
        vegetationTypes: ['bush', 'rock'],
        treeColor: 0x5a6a3a,
        rockColor: 0x9a5a3a,
        grassDensity: 0.2,
        rockDensity: 0.7,
      },
      mixed: {
        baseColor: { 
          sand: [0.88, 0.78, 0.62], 
          grass: [0.28, 0.52, 0.22], 
          rock: [0.52, 0.48, 0.42], 
          snow: [0.96, 0.96, 1.0] 
        },
        grassColor: { top: '#6baa2e', bottom: '#2d5a12', dry: '#a8c256' },
        heightMultiplier: 1.0,
        islandFactor: 0.4,
        vegetationTypes: ['tree', 'palm', 'bush', 'pine'],
        treeColor: 0x2a6b2a,
        rockColor: 0x6a6a6a,
        grassDensity: 0.7,
        rockDensity: 0.35,
      },
    };
    return configs[biome] || configs.temperate;
  }, [biome]);

  // Generate terrain and vegetation data
  const { geometry, vegetationData, grassData, rockData } = useMemo(() => {
    const planeWidth = terrainSize;
    const planeHeight = terrainSize;
    const cols = segmentsX + 1;
    const rows = segmentsY + 1;

    const heightMap = new Float32Array(rows * cols);
    const slopeMap = new Float32Array(rows * cols);
    
    // Helper functions
    const fbm = (noise: NoiseFunction2D, x: number, y: number, octaves: number, persistence: number, lacunarity: number) => {
      let total = 0;
      let frequency = 1;
      let amplitude = 1;
      let maxValue = 0;
      
      for (let i = 0; i < octaves; i++) {
        total += noise(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      
      return total / maxValue;
    };
    
    const ridgeNoise = (noise: NoiseFunction2D, x: number, y: number, octaves: number) => {
      let total = 0;
      let frequency = 1;
      let amplitude = 1;
      
      for (let i = 0; i < octaves; i++) {
        const n = 1 - Math.abs(noise(x * frequency, y * frequency));
        total += n * n * amplitude;
        amplitude *= 0.5;
        frequency *= 2.1;
      }
      
      return total;
    };
    
    // First pass: Generate heightmap
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const x = (col / cols - 0.5) * planeWidth;
        const z = (row / rows - 0.5) * planeHeight;
        
        const nx = x / planeWidth;
        const nz = z / planeHeight;
        
        const warpAmount = terrainSize * 0.15;
        const warpedX = x + noiseGenerators.warpX(nx * 2, nz * 2) * warpAmount;
        const warpedZ = z + noiseGenerators.warpY(nx * 2, nz * 2) * warpAmount;
        
        const continentalScale = scale * 0.3;
        const continental = fbm(noiseGenerators.continental, warpedX * continentalScale, warpedZ * continentalScale, 4, 0.5, 2.0);
        
        const mountainScale = scale * 0.8;
        const mountains = ridgeNoise(noiseGenerators.mountain, warpedX * mountainScale, warpedZ * mountainScale, 4) * mountainousness;
        
        const hillScale = scale * 1.5;
        const hills = fbm(noiseGenerators.hills, warpedX * hillScale, warpedZ * hillScale, 5, 0.5, 2.2) * 0.3;
        
        const detailScale = scale * 4;
        const detail = fbm(noiseGenerators.detail, x * detailScale, z * detailScale, 3, 0.5, 2.0) * 0.1;
        
        const distFromCenter = Math.sqrt(x * x + z * z);
        const normalizedDist = distFromCenter / (terrainSize * 0.5);
        const islandMask = biomeConfig.islandFactor > 0 
          ? Math.pow(1 - Math.min(1, normalizedDist), 2 + biomeConfig.islandFactor * 2)
          : 1;
        
        let baseHeight = (
          continental * 0.4 +
          mountains * 0.35 +
          hills * (1 - mountainousness * 0.5) +
          detail
        );
        
        const flatnessThreshold = 0.3;
        if (flatness > 0 && baseHeight > flatnessThreshold) {
          const excessHeight = baseHeight - flatnessThreshold;
          baseHeight = flatnessThreshold + excessHeight * (1 - flatness * 0.7);
        }
        
        baseHeight *= islandMask;
        baseHeight *= biomeConfig.heightMultiplier;
        
        let finalHeight = baseHeight * height;
        
        if (biomeConfig.islandFactor > 0 && normalizedDist > 0.6) {
          const coastFade = (normalizedDist - 0.6) / 0.4;
          finalHeight = Math.min(finalHeight, waterLevel + 3 * (1 - coastFade));
        }
        
        heightMap[idx] = finalHeight;
      }
    }
    
    // Erosion pass
    const erodeIterations = Math.floor(erosionStrength * 8);
    const talusAngle = 0.6;
    
    for (let iter = 0; iter < erodeIterations; iter++) {
      for (let row = 1; row < rows - 1; row++) {
        for (let col = 1; col < cols - 1; col++) {
          const idx = row * cols + col;
          const currentHeight = heightMap[idx];
          
          const neighbors = [
            heightMap[(row - 1) * cols + col],
            heightMap[(row + 1) * cols + col],
            heightMap[row * cols + col - 1],
            heightMap[row * cols + col + 1],
          ];
          
          let minHeight = currentHeight;
          let minIdx = -1;
          for (let n = 0; n < neighbors.length; n++) {
            if (neighbors[n] < minHeight) {
              minHeight = neighbors[n];
              minIdx = n;
            }
          }
          
          const heightDiff = currentHeight - minHeight;
          const cellSize = terrainSize / segmentsX;
          const slope = heightDiff / cellSize;
          
          if (slope > talusAngle && minIdx >= 0) {
            const transfer = (heightDiff - talusAngle * cellSize) * 0.5 * erosionStrength;
            heightMap[idx] -= transfer;
          }
        }
      }
    }
    
    // Create geometry
    const geom = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);
    geom.rotateX(-Math.PI / 2);
    
    const positions = geom.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const vegetationPositions: Array<{ x: number; y: number; z: number; type: string; scale: number; rotation: number }> = [];
    const grassPositions: Array<{ x: number; y: number; z: number; scale: number; rotation: number }> = [];
    const rockPositions: Array<{ x: number; y: number; z: number; scale: number; rotation: number }> = [];
    
    // Apply heights and colors
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const heightValue = heightMap[idx];
        
        positions.setY(idx, heightValue);
        
        // Calculate slope
        let slope = 0;
        if (row > 0 && row < rows - 1 && col > 0 && col < cols - 1) {
          const left = heightMap[row * cols + col - 1];
          const right = heightMap[row * cols + col + 1];
          const up = heightMap[(row - 1) * cols + col];
          const down = heightMap[(row + 1) * cols + col];
          slope = Math.sqrt(Math.pow(right - left, 2) + Math.pow(down - up, 2));
        }
        slopeMap[idx] = slope;
        
        // Color zones
        const normalizedHeight = (heightValue - waterLevel) / height;
        const sandLine = 0.02;
        const grassLine = 0.15;
        const rockLine = 0.5;
        const snowLine = 0.8;
        
        let r = 0, g = 0, b = 0;
        const colorVar = noiseGenerators.detail(col * 0.2, row * 0.2) * 0.08;
        
        if (heightValue < waterLevel) {
          [r, g, b] = [0.15, 0.25, 0.35];
        } else if (normalizedHeight < sandLine) {
          [r, g, b] = biomeConfig.baseColor.sand;
          r += colorVar; g += colorVar * 0.8; b += colorVar * 0.5;
        } else if (normalizedHeight < grassLine || slope < 0.3) {
          const blend = Math.min(1, (normalizedHeight - sandLine) / (grassLine - sandLine));
          const sandColor = biomeConfig.baseColor.sand;
          const grassColor = biomeConfig.baseColor.grass;
          r = sandColor[0] * (1 - blend) + grassColor[0] * blend + colorVar * 0.5;
          g = sandColor[1] * (1 - blend) + grassColor[1] * blend + colorVar;
          b = sandColor[2] * (1 - blend) + grassColor[2] * blend + colorVar * 0.3;
        } else if (normalizedHeight < rockLine || slope > 0.5) {
          const blend = Math.min(1, (normalizedHeight - grassLine) / (rockLine - grassLine));
          const grassColor = biomeConfig.baseColor.grass;
          const rockColor = biomeConfig.baseColor.rock;
          const slopeFactor = Math.min(1, slope / 0.8);
          r = grassColor[0] * (1 - blend) * (1 - slopeFactor) + rockColor[0] * (blend + slopeFactor * 0.5) + colorVar;
          g = grassColor[1] * (1 - blend) * (1 - slopeFactor) + rockColor[1] * (blend + slopeFactor * 0.5) + colorVar;
          b = grassColor[2] * (1 - blend) * (1 - slopeFactor) + rockColor[2] * (blend + slopeFactor * 0.5) + colorVar;
        } else if (normalizedHeight < snowLine) {
          const rockColor = biomeConfig.baseColor.rock;
          const snowColor = biomeConfig.baseColor.snow;
          const blend = (normalizedHeight - rockLine) / (snowLine - rockLine);
          r = rockColor[0] * (1 - blend) + snowColor[0] * blend + colorVar;
          g = rockColor[1] * (1 - blend) + snowColor[1] * blend + colorVar;
          b = rockColor[2] * (1 - blend) + snowColor[2] * blend + colorVar;
        } else {
          const snowColor = biomeConfig.baseColor.snow;
          r = snowColor[0] + colorVar * 0.5;
          g = snowColor[1] + colorVar * 0.5;
          b = snowColor[2] + colorVar * 0.3;
        }
        
        colors[idx * 3] = Math.max(0, Math.min(1, r));
        colors[idx * 3 + 1] = Math.max(0, Math.min(1, g));
        colors[idx * 3 + 2] = Math.max(0, Math.min(1, b));
        
        const px = positions.getX(idx);
        const pz = positions.getZ(idx);
        
        // Vegetation (trees, palms, bushes, cacti)
        if (
          heightValue > waterLevel + 0.5 &&
          normalizedHeight > sandLine &&
          normalizedHeight < rockLine &&
          slope < 0.4
        ) {
          const vegNoise = noiseGenerators.vegetation(col * 0.12, row * 0.12);
          const placementChance = vegetationDensity * (1 - slope * 2) * (1 - normalizedHeight * 0.5);
          
          if (vegNoise > 1 - placementChance * 0.25) {
            const vegTypes = biomeConfig.vegetationTypes;
            const typeIndex = Math.floor(Math.abs(noiseGenerators.vegetation(col * 0.3, row * 0.3) + 1) * 0.5 * vegTypes.length) % vegTypes.length;
            const vegType = vegTypes[typeIndex];
            const vegScale = 0.5 + Math.abs(vegNoise) * 1.0;
            const rotation = noiseGenerators.vegetation(px * 0.1, pz * 0.1) * Math.PI * 2;
            
            if (vegType !== 'rock') {
              vegetationPositions.push({
                x: px + (vegNoise - 0.5) * 3,
                y: heightValue,
                z: pz + (noiseGenerators.vegetation(col * 0.25, row * 0.25) - 0.5) * 3,
                type: vegType,
                scale: vegScale,
                rotation,
              });
            }
          }
        }
        
        // Grass (denser in grass zones)
        if (
          heightValue > waterLevel + 0.2 &&
          normalizedHeight > sandLine * 0.5 &&
          normalizedHeight < rockLine * 1.1 &&
          slope < 0.45
        ) {
          const grassNoise = noiseGenerators.grass(col * 0.5, row * 0.5);
          const grassChance = vegetationDensity * biomeConfig.grassDensity * (1 - slope * 1.5);
          
          // Multiple grass per cell
          const grassCount = Math.floor(grassChance * 4);
          for (let g = 0; g < grassCount; g++) {
            const offsetNoise = noiseGenerators.grass(col * 0.9 + g * 0.3, row * 0.9 + g * 0.3);
            if (Math.abs(offsetNoise) < grassChance * 0.8) {
              const grassScale = 0.4 + Math.abs(grassNoise) * 0.8;
              grassPositions.push({
                x: px + offsetNoise * 4,
                y: heightValue,
                z: pz + noiseGenerators.grass(col * 1.1 + g, row * 1.1 + g) * 4,
                scale: grassScale,
                rotation: offsetNoise * Math.PI * 2,
              });
            }
          }
        }
        
        // Rocks
        if (heightValue > waterLevel - 0.5) {
          const rockNoise = noiseGenerators.rocks(col * 0.15, row * 0.15);
          const rockChance = biomeConfig.rockDensity * vegetationDensity * 0.25;
          
          const slopeFactor = slope > 0.25 ? 2.5 : 1;
          const heightFactor = normalizedHeight > 0.35 ? 1.8 : 1;
          
          if (rockNoise > 1 - rockChance * slopeFactor * heightFactor) {
            const rockScale = 0.15 + Math.abs(rockNoise) * 0.6;
            rockPositions.push({
              x: px + rockNoise * 2.5,
              y: heightValue - rockScale * 0.2,
              z: pz + noiseGenerators.rocks(col * 0.25, row * 0.25) * 2.5,
              scale: rockScale,
              rotation: rockNoise * Math.PI * 2,
            });
          }
        }
      }
    }
    
    positions.needsUpdate = true;
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    
    return {
      geometry: geom,
      vegetationData: vegetationPositions,
      grassData: grassPositions,
      rockData: rockPositions,
    };
  }, [seed, scale, height, waterLevel, segmentsX, segmentsY, noiseGenerators, vegetationDensity, terrainSize, biome, biomeConfig, erosionStrength, flatness, mountainousness, coastalBlend]);

  // Filter vegetation
  const trees = useMemo(() => vegetationData.filter(v => v.type === 'tree'), [vegetationData]);
  const pines = useMemo(() => vegetationData.filter(v => v.type === 'pine'), [vegetationData]);
  const palms = useMemo(() => vegetationData.filter(v => v.type === 'palm'), [vegetationData]);
  const cacti = useMemo(() => vegetationData.filter(v => v.type === 'cactus'), [vegetationData]);
  const bushes = useMemo(() => vegetationData.filter(v => v.type === 'bush'), [vegetationData]);

  // Set up instanced meshes
  useEffect(() => {
    if (!showVegetation) return;
    
    const dummy = new THREE.Object3D();
    
    // Trees
    if (instancedTreesRef.current && trees.length > 0) {
      const count = Math.min(trees.length, 2000);
      for (let i = 0; i < count; i++) {
        const tree = trees[i];
        dummy.position.set(tree.x, tree.y, tree.z);
        dummy.scale.setScalar(tree.scale);
        dummy.rotation.y = tree.rotation;
        dummy.updateMatrix();
        instancedTreesRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedTreesRef.current.count = count;
      instancedTreesRef.current.instanceMatrix.needsUpdate = true;
    }
    
    // Pines
    if (instancedPinesRef.current && pines.length > 0) {
      const count = Math.min(pines.length, 2000);
      for (let i = 0; i < count; i++) {
        const pine = pines[i];
        dummy.position.set(pine.x, pine.y, pine.z);
        dummy.scale.setScalar(pine.scale * 1.3);
        dummy.rotation.y = pine.rotation;
        dummy.updateMatrix();
        instancedPinesRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedPinesRef.current.count = count;
      instancedPinesRef.current.instanceMatrix.needsUpdate = true;
    }
    
    // Palms
    if (instancedPalmsRef.current && palms.length > 0) {
      const count = Math.min(palms.length, 1500);
      for (let i = 0; i < count; i++) {
        const palm = palms[i];
        dummy.position.set(palm.x, palm.y, palm.z);
        dummy.scale.setScalar(palm.scale * 1.1);
        dummy.rotation.y = palm.rotation;
        dummy.updateMatrix();
        instancedPalmsRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedPalmsRef.current.count = count;
      instancedPalmsRef.current.instanceMatrix.needsUpdate = true;
    }
    
    // Cacti
    if (instancedCactusRef.current && cacti.length > 0) {
      const count = Math.min(cacti.length, 1000);
      for (let i = 0; i < count; i++) {
        const cactus = cacti[i];
        dummy.position.set(cactus.x, cactus.y, cactus.z);
        dummy.scale.setScalar(cactus.scale);
        dummy.rotation.y = cactus.rotation;
        dummy.updateMatrix();
        instancedCactusRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedCactusRef.current.count = count;
      instancedCactusRef.current.instanceMatrix.needsUpdate = true;
    }
    
    // Bushes
    if (instancedBushesRef.current && bushes.length > 0) {
      const count = Math.min(bushes.length, 3000);
      for (let i = 0; i < count; i++) {
        const bush = bushes[i];
        dummy.position.set(bush.x, bush.y, bush.z);
        dummy.scale.setScalar(bush.scale);
        dummy.rotation.y = bush.rotation;
        dummy.updateMatrix();
        instancedBushesRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedBushesRef.current.count = count;
      instancedBushesRef.current.instanceMatrix.needsUpdate = true;
    }
    
    // Rocks
    if (instancedRocksRef.current && rockData.length > 0) {
      const count = Math.min(rockData.length, 2000);
      for (let i = 0; i < count; i++) {
        const rock = rockData[i];
        dummy.position.set(rock.x, rock.y, rock.z);
        dummy.scale.setScalar(rock.scale);
        dummy.rotation.set(rock.rotation * 0.3, rock.rotation, rock.rotation * 0.2);
        dummy.updateMatrix();
        instancedRocksRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedRocksRef.current.count = count;
      instancedRocksRef.current.instanceMatrix.needsUpdate = true;
    }
    
    // Grass
    if (instancedGrassRef.current && grassData.length > 0) {
      const count = Math.min(grassData.length, 50000);
      for (let i = 0; i < count; i++) {
        const grass = grassData[i];
        dummy.position.set(grass.x, grass.y, grass.z);
        dummy.scale.set(grass.scale, grass.scale * (0.7 + Math.random() * 0.6), grass.scale);
        dummy.rotation.y = grass.rotation;
        dummy.updateMatrix();
        instancedGrassRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedGrassRef.current.count = count;
      instancedGrassRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [showVegetation, trees, pines, palms, cacti, bushes, rockData, grassData]);

  // Animate
  useFrame((state) => {
    if (waterMaterial) {
      waterMaterial.uTime = state.clock.elapsedTime;
    }
    if (grassMaterialRef.current) {
      grassMaterialRef.current.uTime = state.clock.elapsedTime;
    }
  });

  // Grass material
  const grassMaterial = useMemo(() => {
    const mat = new GrassMaterial();
    mat.side = THREE.DoubleSide;
    mat.uGrassColorTop = new THREE.Color(biomeConfig.grassColor.top);
    mat.uGrassColorBottom = new THREE.Color(biomeConfig.grassColor.bottom);
    mat.uGrassColorDry = new THREE.Color(biomeConfig.grassColor.dry);
    return mat;
  }, [biomeConfig.grassColor]);

  useEffect(() => {
    grassMaterialRef.current = grassMaterial;
  }, [grassMaterial]);

  return (
    <group>
      {/* Terrain */}
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          flatShading={false}
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>

      {/* Water */}
      <mesh
        ref={waterRef}
        position={[0, waterLevel, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        material={waterMaterial}
      >
        <planeGeometry args={[terrainSize * 4, terrainSize * 4, 196, 196]} />
      </mesh>

      {/* Physics */}
      {enableCollision && (
        <>
          <RigidBody ref={rigidBodyRef} type="fixed" colliders={false}>
            <TrimeshCollider
              args={[
                geometry.attributes.position.array as Float32Array,
                geometry.index?.array as Uint32Array
              ]}
            />
          </RigidBody>
          
          <RigidBody type="fixed" position={[0, waterLevel - 0.1, 0]} sensor>
            <CuboidCollider args={[terrainSize * 0.75, 0.1, terrainSize * 0.75]} sensor />
          </RigidBody>
        </>
      )}

      {/* Vegetation */}
      {showVegetation && (
        <>
          {/* Deciduous Trees */}
          {trees.length > 0 && (
            <instancedMesh
              ref={instancedTreesRef}
              args={[vegetationGeometries.tree, undefined, Math.min(trees.length, 2000)]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={biomeConfig.treeColor} flatShading />
            </instancedMesh>
          )}

          {/* Pine Trees */}
          {pines.length > 0 && (
            <instancedMesh
              ref={instancedPinesRef}
              args={[vegetationGeometries.pine, undefined, Math.min(pines.length, 2000)]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={0x1a4a2a} flatShading />
            </instancedMesh>
          )}

          {/* Palm Trees */}
          {palms.length > 0 && (
            <instancedMesh
              ref={instancedPalmsRef}
              args={[vegetationGeometries.palm, undefined, Math.min(palms.length, 1500)]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={0x228b22} flatShading />
            </instancedMesh>
          )}

          {/* Cacti */}
          {cacti.length > 0 && (
            <instancedMesh
              ref={instancedCactusRef}
              args={[vegetationGeometries.cactus, undefined, Math.min(cacti.length, 1000)]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={0x4a8b3a} flatShading />
            </instancedMesh>
          )}

          {/* Bushes */}
          {bushes.length > 0 && (
            <instancedMesh
              ref={instancedBushesRef}
              args={[vegetationGeometries.bush, undefined, Math.min(bushes.length, 3000)]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={biomeConfig.treeColor} flatShading roughness={0.9} />
            </instancedMesh>
          )}

          {/* Rocks */}
          {rockData.length > 0 && (
            <instancedMesh
              ref={instancedRocksRef}
              args={[vegetationGeometries.rock, undefined, Math.min(rockData.length, 2000)]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={biomeConfig.rockColor} flatShading roughness={0.95} />
            </instancedMesh>
          )}

          {/* Grass */}
          {grassData.length > 0 && (
            <instancedMesh
              ref={instancedGrassRef}
              args={[vegetationGeometries.grass, undefined, Math.min(grassData.length, 50000)]}
              castShadow={false}
              receiveShadow
              material={grassMaterial}
            />
          )}
        </>
      )}
    </group>
  );
};

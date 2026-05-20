/**
 * VolumetricLighting - Efeitos de luz volumétrica (God Rays)
 * 
 * Simula raios de luz visíveis através de partículas na atmosfera
 * Similar ao efeito RTX de luz atravessando névoa/poeira
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SpotLight } from '@react-three/drei';

interface GodRaysProps {
  position?: [number, number, number];
  target?: [number, number, number];
  color?: string;
  intensity?: number;
  angle?: number;
  distance?: number;
  penumbra?: number;
  volumetric?: boolean;
  particleCount?: number;
}

/**
 * GodRays - Raios de luz volumétricos usando SpotLight + partículas
 */
export const GodRays = ({
  position = [0, 20, 0],
  target = [0, 0, 0],
  color = '#fffae6',
  intensity = 2,
  angle = 0.5,
  distance = 30,
  penumbra = 0.5,
  volumetric = true,
  particleCount = 100,
}: GodRaysProps) => {
  const particlesRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  
  // Create dust particles for volumetric effect
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    // Calculate light cone bounds
    const direction = new THREE.Vector3(
      target[0] - position[0],
      target[1] - position[1],
      target[2] - position[2]
    ).normalize();
    
    for (let i = 0; i < particleCount; i++) {
      // Random position within light cone
      const t = Math.random(); // Distance along ray (0 = source, 1 = target)
      const radius = Math.tan(angle) * distance * t * Math.random();
      const theta = Math.random() * Math.PI * 2;
      
      const basePos = new THREE.Vector3(
        position[0] + direction.x * distance * t,
        position[1] + direction.y * distance * t,
        position[2] + direction.z * distance * t
      );
      
      // Offset perpendicular to light direction
      const offset = new THREE.Vector3(
        Math.cos(theta) * radius,
        0,
        Math.sin(theta) * radius
      );
      
      positions[i * 3] = basePos.x + offset.x;
      positions[i * 3 + 1] = basePos.y + offset.y;
      positions[i * 3 + 2] = basePos.z + offset.z;
      
      // Random slow velocities for floating dust
      velocities[i * 3] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 1] = Math.random() * 0.005;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    
    return { positions, velocities };
  }, [position, target, angle, distance, particleCount]);
  
  // Animate dust particles
  useFrame(() => {
    if (!particlesRef.current || !volumetric) return;
    
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];
      
      // Reset particles that float too far
      if (positions[i * 3 + 1] > position[1] + 5) {
        positions[i * 3 + 1] = target[1];
      }
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  const dustMaterial = useMemo(() => new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size: 0.08,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color]);
  
  return (
    <group>
      {/* Main spotlight */}
      <SpotLight
        ref={lightRef}
        position={position}
        angle={angle}
        penumbra={penumbra}
        intensity={intensity}
        distance={distance}
        color={color}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      >
        {/* Target for spotlight */}
        <mesh position={[target[0] - position[0], target[1] - position[1], target[2] - position[2]]} visible={false}>
          <sphereGeometry args={[0.1]} />
        </mesh>
      </SpotLight>
      
      {/* Volumetric dust particles */}
      {volumetric && (
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={particleCount}
              array={positions}
              itemSize={3}
            />
          </bufferGeometry>
          <primitive object={dustMaterial} attach="material" />
        </points>
      )}
    </group>
  );
};

/**
 * AuroraEffect - Aurora boreal para céus noturnos
 * Baseado nas imagens RTX com céu colorido
 */
interface AuroraProps {
  position?: [number, number, number];
  width?: number;
  height?: number;
  colors?: string[];
  speed?: number;
  intensity?: number;
}

export const AuroraEffect = ({
  position = [0, 50, -100],
  width = 200,
  height = 40,
  colors = ['#00ff88', '#00aaff', '#ff00aa'],
  speed = 0.3,
  intensity = 1,
}: AuroraProps) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const auroraShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(colors[0]) },
      uColor2: { value: new THREE.Color(colors[1]) },
      uColor3: { value: new THREE.Color(colors[2] || colors[0]) },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uIntensity;
      varying vec2 vUv;
      
      // Simplex noise function
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
          + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
          dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
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
      
      void main() {
        // Create flowing aurora pattern
        float noise1 = snoise(vec2(vUv.x * 3.0 + uTime * 0.5, vUv.y * 2.0));
        float noise2 = snoise(vec2(vUv.x * 2.0 - uTime * 0.3, vUv.y * 3.0 + uTime * 0.2));
        float noise3 = snoise(vec2(vUv.x * 4.0 + uTime * 0.4, vUv.y * 1.5 - uTime * 0.1));
        
        // Combine noises for curtain effect
        float curtain = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2) * 0.5 + 0.5;
        
        // Vertical fade (stronger at top)
        float verticalFade = pow(vUv.y, 0.5);
        
        // Horizontal variation
        float horizontalWave = sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5;
        
        // Color mixing based on position and time
        float colorMix1 = sin(vUv.x * 2.0 + uTime * 0.5) * 0.5 + 0.5;
        float colorMix2 = cos(vUv.x * 3.0 - uTime * 0.3) * 0.5 + 0.5;
        
        vec3 color = mix(uColor1, uColor2, colorMix1);
        color = mix(color, uColor3, colorMix2 * 0.5);
        
        // Final alpha with curtain and fade effects
        float alpha = curtain * verticalFade * horizontalWave * uIntensity;
        alpha *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        
        gl_FragColor = vec4(color, alpha * 0.6);
      }
    `,
  }), [colors, intensity]);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime() * speed;
    }
  });
  
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={materialRef}
        {...auroraShader}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

/**
 * MoonGlow - Lua com halo brilhante
 */
interface MoonGlowProps {
  position?: [number, number, number];
  size?: number;
  color?: string;
  glowIntensity?: number;
}

export const MoonGlow = ({
  position = [50, 80, -100],
  size = 10,
  color = '#fffae6',
  glowIntensity = 1,
}: MoonGlowProps) => {
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
      glowRef.current.scale.setScalar(scale);
    }
  });
  
  return (
    <group position={position}>
      {/* Moon sphere */}
      <mesh>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * 1.5, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15 * glowIntensity}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[size * 2.5, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.05 * glowIntensity}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Point light for illumination */}
      <pointLight
        color={color}
        intensity={glowIntensity * 0.5}
        distance={200}
        decay={2}
      />
    </group>
  );
};

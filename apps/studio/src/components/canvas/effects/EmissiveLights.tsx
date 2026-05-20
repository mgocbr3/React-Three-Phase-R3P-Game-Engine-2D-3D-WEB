/**
 * EmissiveLights - Luzes emissivas estilo Minecraft RTX
 * 
 * Tochas, fogueiras, lanternas com glow realista
 * Baseado nas imagens de referência com iluminação noturna
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TorchProps {
  position?: [number, number, number];
  color?: string;
  intensity?: number;
  flicker?: boolean;
  castShadow?: boolean;
}

/**
 * MinecraftTorch - Tocha voxel com luz emissiva e flickering
 */
export const MinecraftTorch = ({
  position = [0, 0, 0],
  color = '#ff6600',
  intensity = 3,
  flicker = true,
  castShadow = true,
}: TorchProps) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const baseIntensity = useRef(intensity);
  
  // Flicker effect
  useFrame(({ clock }) => {
    if (!flicker) return;
    
    const time = clock.getElapsedTime();
    const noise = Math.sin(time * 15) * 0.2 + Math.sin(time * 23) * 0.1 + Math.sin(time * 31) * 0.05;
    
    if (lightRef.current) {
      lightRef.current.intensity = baseIntensity.current + noise;
    }
    
    if (flameRef.current) {
      flameRef.current.scale.y = 1 + noise * 0.3;
      flameRef.current.position.y = 0.6 + noise * 0.05;
    }
  });
  
  return (
    <group position={position}>
      {/* Torch stick */}
      <mesh castShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color="#5c3d2e" />
      </mesh>
      
      {/* Flame core (bright) */}
      <mesh ref={flameRef} position={[0, 0.6, 0]}>
        <boxGeometry args={[0.12, 0.2, 0.12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Flame glow outer */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Point light */}
      <pointLight
        ref={lightRef}
        position={[0, 0.7, 0]}
        color={color}
        intensity={intensity}
        distance={12}
        decay={2}
        castShadow={castShadow}
        shadow-mapSize={[256, 256]}
        shadow-bias={-0.001}
      />
    </group>
  );
};

interface CampfireProps {
  position?: [number, number, number];
  size?: number;
  color?: string;
  intensity?: number;
  particleCount?: number;
}

/**
 * MinecraftCampfire - Fogueira com partículas de fogo e fumaça
 */
export const MinecraftCampfire = ({
  position = [0, 0, 0],
  size = 1,
  color = '#ff4400',
  intensity = 5,
  particleCount = 30,
}: CampfireProps) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const baseIntensity = useRef(intensity);
  
  // Fire particle positions and velocities
  const { particlePositions, particleVelocities, particleColors, particleSizes } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    const fireColor = new THREE.Color(color);
    const smokeColor = new THREE.Color('#444444');
    
    for (let i = 0; i < particleCount; i++) {
      // Initial position around campfire
      positions[i * 3] = (Math.random() - 0.5) * size * 0.5;
      positions[i * 3 + 1] = Math.random() * size * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * size * 0.5;
      
      // Upward velocity with random variation
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = 0.02 + Math.random() * 0.03;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      
      // Color gradient: fire at bottom, smoke at top
      const t = i / particleCount;
      const particleColor = t < 0.6 ? fireColor : smokeColor;
      colors[i * 3] = particleColor.r;
      colors[i * 3 + 1] = particleColor.g;
      colors[i * 3 + 2] = particleColor.b;
      
      // Size variation
      sizes[i] = 0.1 + Math.random() * 0.15;
    }
    
    return { 
      particlePositions: positions, 
      particleVelocities: velocities,
      particleColors: colors,
      particleSizes: sizes
    };
  }, [particleCount, size, color]);
  
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    // Flicker light
    if (lightRef.current) {
      const noise = Math.sin(time * 10) * 0.3 + Math.sin(time * 17) * 0.15;
      lightRef.current.intensity = baseIntensity.current + noise;
    }
    
    // Animate particles
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += particleVelocities[i * 3];
        positions[i * 3 + 1] += particleVelocities[i * 3 + 1];
        positions[i * 3 + 2] += particleVelocities[i * 3 + 2];
        
        // Reset particle when it rises too high
        if (positions[i * 3 + 1] > size * 3) {
          positions[i * 3] = (Math.random() - 0.5) * size * 0.5;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = (Math.random() - 0.5) * size * 0.5;
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <group position={position}>
      {/* Log base - crossed logs */}
      <mesh castShadow position={[0, 0.1, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[size * 1.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#3d2314" />
      </mesh>
      <mesh castShadow position={[0, 0.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[size * 1.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#3d2314" />
      </mesh>
      <mesh castShadow position={[0, 0.25, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[size * 0.8, 0.15, 0.15]} />
        <meshStandardMaterial color="#4a2a14" />
      </mesh>
      
      {/* Fire core */}
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[size * 0.3, size * 0.8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Inner fire glow */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[size * 0.5, 16, 16]} />
        <meshBasicMaterial
          color="#ffaa00"
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* Outer fire glow */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[size * 0.8, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
        />
      </mesh>
      
      {/* Fire/smoke particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={particlePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={particleCount}
            array={particleColors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          vertexColors
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      
      {/* Main point light */}
      <pointLight
        ref={lightRef}
        position={[0, 0.8, 0]}
        color={color}
        intensity={intensity}
        distance={20}
        decay={2}
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.001}
      />
      
      {/* Secondary warm light for fill */}
      <pointLight
        position={[0, 0.3, 0]}
        color="#ffcc00"
        intensity={intensity * 0.3}
        distance={8}
        decay={2}
      />
    </group>
  );
};

interface LanternProps {
  position?: [number, number, number];
  color?: string;
  intensity?: number;
  hanging?: boolean;
}

/**
 * MinecraftLantern - Lanterna com luz quente
 */
export const MinecraftLantern = ({
  position = [0, 0, 0],
  color = '#ffaa00',
  intensity = 2,
  hanging = false,
}: LanternProps) => {
  const lightRef = useRef<THREE.PointLight>(null);
  
  useFrame(({ clock }) => {
    if (lightRef.current) {
      const time = clock.getElapsedTime();
      const flicker = Math.sin(time * 8) * 0.1 + Math.sin(time * 13) * 0.05;
      lightRef.current.intensity = intensity + flicker;
    }
  });
  
  return (
    <group position={position}>
      {/* Chain if hanging */}
      {hanging && (
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.05, 0.3, 0.05]} />
          <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.3} />
        </mesh>
      )}
      
      {/* Lantern top cap */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.35, 0.08, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
      </mesh>
      
      {/* Lantern frame */}
      {/* Vertical bars */}
      {[[-0.12, 0.12], [0.12, 0.12], [-0.12, -0.12], [0.12, -0.12]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} castShadow>
          <boxGeometry args={[0.04, 0.35, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      
      {/* Lantern glass (emissive) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.22, 0.28, 0.22]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Lantern bottom */}
      <mesh position={[0, -0.2, 0]} castShadow>
        <boxGeometry args={[0.3, 0.06, 0.3]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
      </mesh>
      
      {/* Point light */}
      <pointLight
        ref={lightRef}
        position={[0, 0, 0]}
        color={color}
        intensity={intensity}
        distance={15}
        decay={2}
        castShadow
        shadow-mapSize={[256, 256]}
      />
    </group>
  );
};

/**
 * GlowBlock - Bloco emisivo genérico (glowstone, redstone lamp, sea lantern)
 */
interface GlowBlockProps {
  position?: [number, number, number];
  size?: number;
  color?: string;
  intensity?: number;
  type?: 'glowstone' | 'redstone_lamp' | 'sea_lantern' | 'shroomlight';
}

export const GlowBlock = ({
  position = [0, 0, 0],
  size = 1,
  intensity = 2,
  type = 'glowstone',
}: GlowBlockProps) => {
  const colors = {
    glowstone: '#ffcc55',
    redstone_lamp: '#ff4400',
    sea_lantern: '#55ffff',
    shroomlight: '#ff8844',
  };
  
  const color = colors[type];
  
  return (
    <group position={position}>
      {/* Main block */}
      <mesh castShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
        />
      </mesh>
      
      {/* Glow aura */}
      <mesh>
        <boxGeometry args={[size * 1.2, size * 1.2, size * 1.2]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Point light */}
      <pointLight
        color={color}
        intensity={intensity}
        distance={20}
        decay={2}
        castShadow
      />
    </group>
  );
};

/**
 * NetherPortal - Portal do Nether com efeito de glow roxo
 */
interface NetherPortalProps {
  position?: [number, number, number];
  size?: [number, number];
}

export const NetherPortal = ({
  position = [0, 0, 0],
  size = [4, 5],
}: NetherPortalProps) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const portalShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
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
      varying vec2 vUv;
      
      void main() {
        // Swirling portal effect
        vec2 center = vUv - 0.5;
        float dist = length(center);
        float angle = atan(center.y, center.x);
        
        float swirl = sin(dist * 10.0 - uTime * 3.0 + angle * 3.0) * 0.5 + 0.5;
        float pulse = sin(uTime * 2.0) * 0.1 + 0.9;
        
        vec3 purple = vec3(0.6, 0.2, 0.8);
        vec3 magenta = vec3(0.9, 0.3, 0.9);
        
        vec3 color = mix(purple, magenta, swirl);
        float alpha = (1.0 - dist * 1.5) * pulse;
        
        gl_FragColor = vec4(color, alpha * 0.9);
      }
    `,
  }), []);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });
  
  return (
    <group position={position}>
      {/* Obsidian frame */}
      {/* Bottom */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[size[0] + 2, 1, 1]} />
        <meshStandardMaterial color="#1a0a2e" roughness={0.9} />
      </mesh>
      {/* Top */}
      <mesh castShadow position={[0, size[1] + 1, 0]}>
        <boxGeometry args={[size[0] + 2, 1, 1]} />
        <meshStandardMaterial color="#1a0a2e" roughness={0.9} />
      </mesh>
      {/* Left */}
      <mesh castShadow position={[-(size[0] / 2 + 0.5), size[1] / 2 + 0.5, 0]}>
        <boxGeometry args={[1, size[1], 1]} />
        <meshStandardMaterial color="#1a0a2e" roughness={0.9} />
      </mesh>
      {/* Right */}
      <mesh castShadow position={[size[0] / 2 + 0.5, size[1] / 2 + 0.5, 0]}>
        <boxGeometry args={[1, size[1], 1]} />
        <meshStandardMaterial color="#1a0a2e" roughness={0.9} />
      </mesh>
      
      {/* Portal surface */}
      <mesh position={[0, size[1] / 2 + 0.5, 0]}>
        <planeGeometry args={[size[0], size[1]]} />
        <shaderMaterial
          ref={materialRef}
          {...portalShader}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Portal glow */}
      <pointLight
        position={[0, size[1] / 2, 1]}
        color="#9900ff"
        intensity={3}
        distance={15}
        decay={2}
      />
    </group>
  );
};

/**
 * RTXWater - Água realista com reflexões e refrações estilo Minecraft RTX
 * 
 * Features:
 * - Reflexões em tempo real usando MeshReflectorMaterial
 * - Animação de ondas
 * - Cor com gradiente de profundidade
 * - Transparência e caustics simulados
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface RTXWaterProps {
  position?: [number, number, number];
  size?: [number, number];
  color?: string;
  deepColor?: string;
  opacity?: number;
  reflectivity?: number;
  waveSpeed?: number;
  waveHeight?: number;
  resolution?: number;
}

export const RTXWater = ({
  position = [0, 0, 0],
  size = [100, 100],
  color = '#20d9d2',
  deepColor = '#0a4a4a',
  opacity = 0.85,
  reflectivity = 0.5,
  waveSpeed = 0.5,
  waveHeight = 0.1,
  resolution = 512,
}: RTXWaterProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.PlaneGeometry>(null);
  
  // Store original positions for wave animation
  const originalPositions = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size[0], size[1], 64, 64);
    return geometry.attributes.position.array.slice();
  }, [size]);
  
  // Animate waves
  useFrame(({ clock }) => {
    if (!geometryRef.current) return;
    
    const positions = geometryRef.current.attributes.position.array as Float32Array;
    const time = clock.getElapsedTime() * waveSpeed;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = originalPositions[i];
      const y = originalPositions[i + 1];
      
      // Multiple sine waves for realistic water movement
      const wave1 = Math.sin(x * 0.1 + time) * waveHeight;
      const wave2 = Math.sin(y * 0.15 + time * 1.3) * waveHeight * 0.5;
      const wave3 = Math.sin((x + y) * 0.08 + time * 0.8) * waveHeight * 0.3;
      
      positions[i + 2] = wave1 + wave2 + wave3;
    }
    
    geometryRef.current.attributes.position.needsUpdate = true;
    geometryRef.current.computeVertexNormals();
  });
  
  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry ref={geometryRef} args={[size[0], size[1], 64, 64]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={resolution}
        mixBlur={1}
        mixStrength={reflectivity}
        roughness={0.3}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color={color}
        metalness={0.1}
        transparent
        opacity={opacity}
        mirror={0.5}
      />
    </mesh>
  );
};

/**
 * RTXWaterSimple - Versão simplificada para melhor performance
 * Usa shader customizado para simular reflexões sem custo de render-to-texture
 */
export const RTXWaterSimple = ({
  position = [0, 0, 0],
  size = [100, 100],
  color = '#20d9d2',
  opacity = 0.75,
  waveSpeed = 0.5,
}: Omit<RTXWaterProps, 'reflectivity' | 'resolution' | 'deepColor'>) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Custom water shader
  const waterShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        
        // Wave displacement
        vec3 pos = position;
        float wave1 = sin(pos.x * 0.1 + uTime) * 0.15;
        float wave2 = sin(pos.y * 0.15 + uTime * 1.3) * 0.1;
        float wave3 = sin((pos.x + pos.y) * 0.08 + uTime * 0.8) * 0.05;
        pos.z += wave1 + wave2 + wave3;
        
        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      void main() {
        // Fresnel effect for edge reflection
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
        
        // Animated caustics pattern
        float caustics = sin(vUv.x * 20.0 + uTime * 2.0) * sin(vUv.y * 20.0 + uTime * 1.5) * 0.1;
        
        // Combine color with fresnel and caustics
        vec3 finalColor = uColor + vec3(fresnel * 0.3) + vec3(caustics);
        
        // Add sparkle highlights
        float sparkle = pow(max(sin(vUv.x * 50.0 + uTime * 3.0) * sin(vUv.y * 50.0 + uTime * 2.5), 0.0), 8.0);
        finalColor += vec3(sparkle * 0.5);
        
        gl_FragColor = vec4(finalColor, uOpacity + fresnel * 0.2);
      }
    `,
  }), [color, opacity]);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime() * waveSpeed;
    }
  });
  
  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[size[0], size[1], 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        {...waterShader}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * MinecraftWater - Água estilo Minecraft com blocos animados
 * Visual voxel mas com reflexões e animação
 */
export const MinecraftWater = ({
  position = [0, 0, 0],
  size = [10, 10],
  color = '#3498db',
  opacity = 0.8,
}: Omit<RTXWaterProps, 'reflectivity' | 'resolution' | 'waveSpeed' | 'waveHeight' | 'deepColor'>) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Animate water level subtly
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const time = clock.getElapsedTime();
      meshRef.current.position.y = position[1] + Math.sin(time * 2) * 0.02;
    }
  });
  
  return (
    <group position={position}>
      {/* Main water surface */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size[0], size[1]]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          metalness={0.1}
          roughness={0.2}
          envMapIntensity={1}
        />
      </mesh>
      
      {/* Underwater depth layer */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size[0], size[1]]} />
        <meshStandardMaterial
          color="#1a5276"
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
};

import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Splat, Environment, ContactShadows, Float } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { MinecraftPlayer } from '../primitives/MinecraftPlayer';

/**
 * PIXLLAND HYPER-CORE TEMPLATE
 * 
 * Arquitetura híbrida revolucionária:
 * - CAMADA VISUAL: Gaussian Splats (volumétrico fotorealista)
 * - CAMADA FÍSICA: Colisores Rapier invisíveis
 * 
 * O jogador vê o cenário splat mas colide com geometria simplificada.
 * Isso permite visual de filme com gameplay sólido.
 */

// Componente para carregar Gaussian Splats com fallback
const SplatScene = ({ 
  src, 
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  rotation = [0, 0, 0] as [number, number, number]
}: {
  src: string;
  position?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
}) => {
  return (
    <Suspense fallback={<SplatFallback />}>
      <Splat 
        src={src}
        position={position}
        scale={scale}
        rotation={rotation}
        alphaTest={0.1}
      />
    </Suspense>
  );
};

// Fallback visual enquanto o splat carrega
const SplatFallback = () => (
  <mesh>
    <sphereGeometry args={[2, 16, 16]} />
    <meshStandardMaterial 
      color="#a855f7" 
      wireframe 
      transparent 
      opacity={0.3}
    />
  </mesh>
);

// Sistema de colisores invisíveis - a "realidade" do jogo
const InvisibleColliders = () => {
  return (
    <>
      {/* CHÃO PRINCIPAL - Plano infinito invisível */}
      <RigidBody type="fixed" colliders={false} name="ground-collider">
        <CuboidCollider args={[100, 0.5, 100]} position={[0, -0.5, 0]} />
      </RigidBody>

      {/* PAREDES INVISÍVEIS - Limites do mapa */}
      <RigidBody type="fixed" colliders={false} name="wall-north">
        <CuboidCollider args={[100, 20, 1]} position={[0, 10, -50]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="wall-south">
        <CuboidCollider args={[100, 20, 1]} position={[0, 10, 50]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="wall-east">
        <CuboidCollider args={[1, 20, 100]} position={[50, 10, 0]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="wall-west">
        <CuboidCollider args={[1, 20, 100]} position={[-50, 10, 0]} />
      </RigidBody>

      {/* OBSTÁCULOS INVISÍVEIS - Colocados manualmente sobre features do splat */}
      {/* Exemplo: rocha grande na posição [10, 0, -15] */}
      <RigidBody type="fixed" colliders={false} name="obstacle-rock-1">
        <CuboidCollider args={[2, 2, 2]} position={[10, 1, -15]} />
      </RigidBody>

      {/* Exemplo: tronco caído */}
      <RigidBody type="fixed" colliders={false} name="obstacle-log-1">
        <CuboidCollider args={[4, 0.5, 0.8]} position={[-8, 0.5, 5]} />
      </RigidBody>

      {/* Plataforma elevada */}
      <RigidBody type="fixed" colliders={false} name="platform-1">
        <CuboidCollider args={[3, 0.3, 3]} position={[0, 3, -20]} />
      </RigidBody>
    </>
  );
};

// Portal visual com efeito de brilho
const HyperPortal = ({ position }: { position: [number, number, number] }) => {
  const portalRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (portalRef.current) {
      portalRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <group position={position}>
        {/* Anel externo */}
        <mesh ref={portalRef} castShadow>
          <torusGeometry args={[3, 0.15, 16, 64]} />
          <meshStandardMaterial 
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
        
        {/* Centro do portal */}
        <mesh>
          <circleGeometry args={[2.8, 64]} />
          <meshStandardMaterial 
            color="#0a0a2e"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Partículas de energia */}
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh 
            key={i}
            position={[
              Math.cos((i / 20) * Math.PI * 2) * 2.5,
              Math.sin((i / 20) * Math.PI * 2) * 2.5,
              0.1
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#00ffff" />
          </mesh>
        ))}
      </group>
    </Float>
  );
};

// Demonstração com cenário procedural (quando não há .splat)
const ProceduralDemoScene = () => {
  return (
    <>
      {/* Chão estilizado - representa onde o splat estaria */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[100, 100, 50, 50]} />
        <meshStandardMaterial 
          color="#1a1a2e"
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* Grid cyberpunk */}
      <gridHelper 
        args={[100, 50, '#a855f7', '#2a2a4a']} 
        position={[0, 0.02, 0]}
      />

      {/* Estruturas neon demonstrativas */}
      <group position={[15, 0, -20]}>
        <mesh castShadow position={[0, 3, 0]}>
          <boxGeometry args={[6, 6, 6]} />
          <meshStandardMaterial 
            color="#0f0f1a"
            emissive="#a855f7"
            emissiveIntensity={0.1}
          />
        </mesh>
        {/* Linhas neon */}
        <mesh position={[0, 6.1, 0]}>
          <boxGeometry args={[6.2, 0.1, 6.2]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
      </group>

      {/* Cilindros luminosos */}
      {[[-10, 8], [10, 8], [-10, -8], [10, -8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2, z]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 4, 16]} />
          <meshStandardMaterial 
            color="#1a1a2e"
            emissive={i % 2 === 0 ? '#a855f7' : '#00ffff'}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Esferas flutuantes */}
      <Float speed={1.5} rotationIntensity={0.2}>
        <mesh position={[-5, 4, 10]} castShadow>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial 
            color="#ec4899"
            emissive="#ec4899"
            emissiveIntensity={0.3}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      </Float>

      <Float speed={2} rotationIntensity={0.3}>
        <mesh position={[8, 5, -5]} castShadow>
          <octahedronGeometry args={[0.8]} />
          <meshStandardMaterial 
            color="#22d3ee"
            emissive="#22d3ee"
            emissiveIntensity={0.4}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </Float>
    </>
  );
};

export const HyperRealisticTemplate = () => {
  // Gaussian Splat público de jardim fotorealista (cakewalk/splat-data)
  // Este arquivo contém uma cena de jardim capturada com técnicas de NeRF/Gaussian Splatting
  const splatUrl = "https://huggingface.co/cakewalk/splat-data/resolve/main/garden.splat";

  // Configurações do jogador para controles touch funcionarem
  const playerSettings = {
    speed: 5,
    jumpForce: 8,
    movementMode: 'free' as const,
    canSprint: true,
    sprintSpeed: 8,
    canDoubleJump: false,
    gravity: 20,
  };

  // Configurações de câmera terceira pessoa
  const cameraSettings = {
    mode: 'third-person' as const,
    distance: 8,
    height: 5,
    fov: 60,
    smoothing: 0.1,
  };

  return (
    <>
      {/* JOGADOR - Personagem 3D tradicional com controles touch */}
      <MinecraftPlayer 
        position={[0, 2, 0]} 
        skinColors={{
          skin: '#c4a574',
          hair: '#1a1a1a',
          shirt: '#a855f7',
          pants: '#1a1a2e',
          shoes: '#0a0a0a'
        }}
        playerSettings={playerSettings}
        cameraSettings={cameraSettings}
      />

      {/* CAMADA VISUAL - Gaussian Splat fotorealista */}
      <SplatScene 
        src={splatUrl}
        position={[0, -1.5, 0]}
        scale={3}
      />

      {/* CAMADA FÍSICA INVISÍVEL */}
      <InvisibleColliders />

      {/* PORTAL HYPER */}
      <HyperPortal position={[0, 4, -30]} />

      {/* ILUMINAÇÃO - Mais clara para visibilidade */}
      <ambientLight intensity={0.6} color="#ffffff" />
      
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        color="#ffeedd"
      />

      {/* Luz de preenchimento (fill light) */}
      <directionalLight
        position={[-15, 10, -5]}
        intensity={0.5}
        color="#ffffff"
      />

      {/* Luz de borda (rim light) para destacar personagem */}
      <pointLight
        position={[0, 8, 20]}
        intensity={0.8}
        color="#ffffff"
        distance={30}
      />

      {/* Environment para reflexões PBR - preset mais claro */}
      <Environment preset="park" />
    </>
  );
};

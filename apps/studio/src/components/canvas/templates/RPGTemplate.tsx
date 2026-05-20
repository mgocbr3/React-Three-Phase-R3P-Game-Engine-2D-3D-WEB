import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Ground } from '../primitives/Ground';

// NPC component for the village
const VillagerNPC = ({ 
  position, 
  color = '#22c55e',
  name = 'Villager'
}: { 
  position: [number, number, number]; 
  color?: string;
  name?: string;
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const startPos = useRef(new THREE.Vector3(...position));
  
  useFrame((state) => {
    if (meshRef.current) {
      // Idle animation - gentle bobbing
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });
  
  return (
    <group ref={meshRef} position={position}>
      {/* Body */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#fcd5b8" />
      </mesh>
      {/* Selection indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.4, 0.5, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// Treasure chest component
const TreasureChest = ({ position, isOpen = false }: { position: [number, number, number]; isOpen?: boolean }) => (
  <group position={position}>
    {/* Base */}
    <mesh castShadow position={[0, 0.3, 0]}>
      <boxGeometry args={[0.8, 0.5, 0.5]} />
      <meshStandardMaterial color="#8b4513" metalness={0.3} roughness={0.7} />
    </mesh>
    {/* Lid */}
    <mesh 
      castShadow 
      position={[0, 0.6, isOpen ? -0.2 : 0]} 
      rotation={[isOpen ? -Math.PI / 3 : 0, 0, 0]}
    >
      <boxGeometry args={[0.8, 0.15, 0.5]} />
      <meshStandardMaterial color="#a0522d" metalness={0.3} roughness={0.7} />
    </mesh>
    {/* Lock */}
    <mesh position={[0, 0.5, 0.26]}>
      <boxGeometry args={[0.15, 0.15, 0.05]} />
      <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} emissive="#fbbf24" emissiveIntensity={0.3} />
    </mesh>
    {/* Glow effect */}
    <pointLight position={[0, 0.5, 0]} color="#fbbf24" intensity={0.5} distance={3} />
  </group>
);

// Building component
const Building = ({ 
  position, 
  size = [4, 3, 4], 
  roofColor = '#8b0000',
  wallColor = '#deb887'
}: { 
  position: [number, number, number]; 
  size?: [number, number, number];
  roofColor?: string;
  wallColor?: string;
}) => (
  <RigidBody type="fixed" position={position}>
    <group>
      {/* Walls */}
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {/* Roof */}
      <mesh castShadow position={[0, size[1] + 0.8, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[size[0] * 0.8, 1.5, 4]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.8, size[2] / 2 + 0.01]}>
        <boxGeometry args={[1, 1.6, 0.1]} />
        <meshStandardMaterial color="#4a3728" />
      </mesh>
    </group>
  </RigidBody>
);

// Tree component
const Tree = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Trunk */}
    <mesh castShadow position={[0, 1, 0]}>
      <cylinderGeometry args={[0.2, 0.3, 2, 8]} />
      <meshStandardMaterial color="#4a3728" />
    </mesh>
    {/* Foliage */}
    <mesh castShadow position={[0, 2.5, 0]}>
      <sphereGeometry args={[1.2, 8, 8]} />
      <meshStandardMaterial color="#228b22" />
    </mesh>
    <mesh castShadow position={[0, 3.3, 0]}>
      <sphereGeometry args={[0.8, 8, 8]} />
      <meshStandardMaterial color="#2d8b2d" />
    </mesh>
  </group>
);

export const RPGTemplate = () => {
  const playerRef = useRef<any>(null);
  const { camera } = useThree();
  
  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });
  
  const playerRotation = useRef(0);
  
  useEffect(() => {
    // Set up isometric camera angle
    camera.position.set(15, 25, 15);
    camera.lookAt(0, 0, 0);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          movement.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          movement.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = true;
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          movement.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          movement.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = false;
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [camera]);
  
  useFrame(() => {
    if (!playerRef.current) return;
    
    const rb = playerRef.current;
    const pos = rb.translation();
    const speed = 7;
    
    // Movement in world space (for top-down)
    let moveX = 0;
    let moveZ = 0;
    
    if (movement.current.forward) moveZ -= 1;
    if (movement.current.backward) moveZ += 1;
    if (movement.current.left) moveX -= 1;
    if (movement.current.right) moveX += 1;
    
    // Normalize diagonal movement
    if (moveX !== 0 && moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;
    }
    
    // Calculate player rotation based on movement
    if (moveX !== 0 || moveZ !== 0) {
      playerRotation.current = Math.atan2(moveX, moveZ);
    }
    
    const currentVel = rb.linvel();
    rb.setLinvel({
      x: moveX * speed,
      y: currentVel.y,
      z: moveZ * speed,
    }, true);
    
    // Camera follows player with isometric offset
    const cameraOffset = new THREE.Vector3(15, 25, 15);
    const targetPos = new THREE.Vector3(pos.x + cameraOffset.x, cameraOffset.y, pos.z + cameraOffset.z);
    camera.position.lerp(targetPos, 0.05);
    camera.lookAt(pos.x, 0, pos.z);
  });
  
  return (
    <>
      {/* ===== PLAYER ===== */}
      <RigidBody ref={playerRef} position={[0, 1, 0]} colliders={false} lockRotations linearDamping={0.9}>
        <CapsuleCollider args={[0.3, 0.4]} />
        <group rotation={[0, playerRotation.current, 0]}>
          {/* Body */}
          <mesh castShadow position={[0, 0.5, 0]}>
            <capsuleGeometry args={[0.4, 0.7, 8, 16]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.2} />
          </mesh>
          {/* Head */}
          <mesh castShadow position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#fcd5b8" />
          </mesh>
          {/* Direction indicator */}
          <mesh position={[0, 0.5, -0.5]}>
            <coneGeometry args={[0.15, 0.4, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          {/* Selection ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <ringGeometry args={[0.5, 0.65, 32]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </RigidBody>
      
      {/* ===== GROUND ===== */}
      <Ground size={[80, 80]} color="#2d5a27" />
      
      {/* Village plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[10, 32]} />
        <meshStandardMaterial color="#a0826d" />
      </mesh>
      
      {/* Paths */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -15]}>
        <planeGeometry args={[3, 20]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, 0.02, 0]}>
        <planeGeometry args={[20, 3]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>
      
      {/* ===== BUILDINGS ===== */}
      <Building position={[-12, 0, -8]} size={[5, 4, 5]} wallColor="#deb887" roofColor="#8b0000" />
      <Building position={[12, 0, -8]} size={[6, 3, 5]} wallColor="#d2b48c" roofColor="#4a5568" />
      <Building position={[-10, 0, 10]} size={[4, 3, 4]} wallColor="#f5deb3" roofColor="#654321" />
      <Building position={[10, 0, 12]} size={[5, 4, 6]} wallColor="#daa520" roofColor="#2f4f4f" />
      
      {/* Castle/Tower in distance */}
      <RigidBody type="fixed" position={[0, 0, -25]}>
        <group>
          <mesh castShadow position={[0, 5, 0]}>
            <cylinderGeometry args={[3, 4, 10, 8]} />
            <meshStandardMaterial color="#696969" />
          </mesh>
          <mesh castShadow position={[0, 11, 0]}>
            <coneGeometry args={[4, 3, 8]} />
            <meshStandardMaterial color="#2f4f4f" />
          </mesh>
          {/* Tower windows */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => (
            <mesh key={i} position={[Math.sin(rot) * 3.5, 6, Math.cos(rot) * 3.5]}>
              <boxGeometry args={[0.8, 1.2, 0.3]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      </RigidBody>
      
      {/* ===== NPCS ===== */}
      <VillagerNPC position={[5, 0, 3]} color="#22c55e" name="Merchant" />
      <VillagerNPC position={[-6, 0, 5]} color="#ef4444" name="Guard" />
      <VillagerNPC position={[8, 0, -5]} color="#a855f7" name="Mage" />
      
      {/* ===== TREASURES ===== */}
      <TreasureChest position={[15, 0, -15]} />
      <TreasureChest position={[-18, 0, 8]} isOpen={true} />
      <TreasureChest position={[20, 0, 20]} />
      
      {/* ===== TREES ===== */}
      <Tree position={[-20, 0, -5]} />
      <Tree position={[-22, 0, 5]} />
      <Tree position={[22, 0, -3]} />
      <Tree position={[25, 0, 8]} />
      <Tree position={[-15, 0, 20]} />
      <Tree position={[18, 0, -20]} />
      <Tree position={[-25, 0, -18]} />
      
      {/* ===== FENCE/WALLS ===== */}
      {/* Village perimeter */}
      <RigidBody type="fixed" position={[0, 0.5, -30]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[60, 1, 0.5]} />
          <meshStandardMaterial color="#4a3728" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, 0.5, 30]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[60, 1, 0.5]} />
          <meshStandardMaterial color="#4a3728" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[-30, 0.5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 1, 60]} />
          <meshStandardMaterial color="#4a3728" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[30, 0.5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 1, 60]} />
          <meshStandardMaterial color="#4a3728" />
        </mesh>
      </RigidBody>
      
      {/* ===== LIGHTING ===== */}
      <ambientLight intensity={0.5} color="#ffeedd" />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      
      {/* Torches around plaza */}
      {[
        [8, 0, 8],
        [-8, 0, 8],
        [8, 0, -8],
        [-8, 0, -8],
      ].map((pos, i) => (
        <pointLight key={i} position={[pos[0], 2, pos[2]]} color="#ff9933" intensity={0.8} distance={10} />
      ))}
    </>
  );
};

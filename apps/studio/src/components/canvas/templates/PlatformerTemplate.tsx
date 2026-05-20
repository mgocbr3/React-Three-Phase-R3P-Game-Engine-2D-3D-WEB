import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

// Collectible coin component
const Coin = ({ position }: { position: [number, number, number] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 3;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });
  
  return (
    <mesh ref={meshRef} position={position} castShadow>
      <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} metalness={0.9} roughness={0.1} />
    </mesh>
  );
};

// Moving platform component
const MovingPlatform = ({ 
  startPos, 
  endPos, 
  speed = 2,
  size = [4, 0.5, 3]
}: { 
  startPos: [number, number, number]; 
  endPos: [number, number, number];
  speed?: number;
  size?: [number, number, number];
}) => {
  const platformRef = useRef<any>(null);
  const progress = useRef(0);
  const direction = useRef(1);
  
  useFrame((state, delta) => {
    if (!platformRef.current) return;
    
    progress.current += delta * speed * 0.1 * direction.current;
    
    if (progress.current >= 1) {
      direction.current = -1;
      progress.current = 1;
    } else if (progress.current <= 0) {
      direction.current = 1;
      progress.current = 0;
    }
    
    const x = THREE.MathUtils.lerp(startPos[0], endPos[0], progress.current);
    const y = THREE.MathUtils.lerp(startPos[1], endPos[1], progress.current);
    const z = THREE.MathUtils.lerp(startPos[2], endPos[2], progress.current);
    
    platformRef.current.setNextKinematicTranslation({ x, y, z });
  });
  
  return (
    <RigidBody ref={platformRef} type="kinematicPosition" position={startPos}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#4ade80" metalness={0.3} roughness={0.7} />
      </mesh>
    </RigidBody>
  );
};

// Spike hazard component
const Spikes = ({ position, width = 3 }: { position: [number, number, number]; width?: number }) => (
  <RigidBody type="fixed" position={position}>
    <group>
      {Array.from({ length: Math.floor(width / 0.5) }).map((_, i) => (
        <mesh key={i} position={[(i - width / 2 + 0.25) * 0.5, 0.3, 0]} castShadow>
          <coneGeometry args={[0.15, 0.6, 4]} />
          <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[width, 0.1, 0.5]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
    </group>
  </RigidBody>
);

// Background parallax layer
const ParallaxLayer = ({ z, color, elements }: { z: number; color: string; elements: [number, number, number][] }) => (
  <group position={[0, 0, z]}>
    {elements.map((pos, i) => (
      <mesh key={i} position={pos}>
        <boxGeometry args={[2 + Math.random() * 3, 10 + Math.random() * 20, 1]} />
        <meshBasicMaterial color={color} />
      </mesh>
    ))}
  </group>
);

export const PlatformerTemplate = () => {
  const playerRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  const movement = useRef({
    left: false,
    right: false,
    jump: false,
  });
  
  const isGrounded = useRef(true);
  const facingRight = useRef(true);
  const jumpCooldown = useRef(0);
  const coyoteTime = useRef(0);
  const jumpBufferTime = useRef(0);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = true;
          break;
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          movement.current.jump = true;
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = false;
          break;
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          movement.current.jump = false;
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  useFrame((state, delta) => {
    if (!playerRef.current) return;
    
    const rb = playerRef.current;
    const pos = rb.translation();
    const currentVel = rb.linvel();
    
    const speed = 10;
    const jumpForce = 14;
    const fallMultiplier = 2.5;
    const lowJumpMultiplier = 2;
    
    // Horizontal movement
    let xVel = 0;
    if (movement.current.left) {
      xVel = -speed;
      facingRight.current = false;
    }
    if (movement.current.right) {
      xVel = speed;
      facingRight.current = true;
    }
    
    // Ground detection (position-based for simplicity)
    const wasGrounded = isGrounded.current;
    isGrounded.current = pos.y < 1.3 || (currentVel.y > -0.5 && currentVel.y < 0.5 && pos.y < 20);
    
    // Coyote time - allows jumping shortly after leaving platform
    if (wasGrounded && !isGrounded.current) {
      coyoteTime.current = 0.1;
    }
    coyoteTime.current = Math.max(0, coyoteTime.current - delta);
    
    // Jump buffer - allows pressing jump slightly before landing
    if (movement.current.jump) {
      jumpBufferTime.current = 0.1;
    }
    jumpBufferTime.current = Math.max(0, jumpBufferTime.current - delta);
    
    // Jumping with coyote time and jump buffer
    let yVel = currentVel.y;
    const canJump = (isGrounded.current || coyoteTime.current > 0) && jumpCooldown.current <= 0;
    
    if (jumpBufferTime.current > 0 && canJump) {
      yVel = jumpForce;
      jumpCooldown.current = 0.15;
      coyoteTime.current = 0;
      jumpBufferTime.current = 0;
    }
    
    jumpCooldown.current = Math.max(0, jumpCooldown.current - delta);
    
    // Variable jump height - release jump button for lower jump
    if (currentVel.y > 0 && !movement.current.jump) {
      yVel += -20 * lowJumpMultiplier * delta;
    }
    
    // Faster falling
    if (currentVel.y < 0) {
      yVel += -20 * (fallMultiplier - 1) * delta;
    }
    
    // Apply velocity - Z is LOCKED to 0 for 2.5D
    rb.setLinvel({ x: xVel, y: yVel, z: 0 }, true);
    
    // Force Z position to 0
    if (Math.abs(pos.z) > 0.01) {
      rb.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
    }
    
    // Update visual mesh
    if (meshRef.current) {
      meshRef.current.position.set(pos.x, pos.y, pos.z);
      
      // Squash and stretch
      const stretchY = 1 + Math.abs(currentVel.y) * 0.01;
      const squashX = 1 / Math.sqrt(stretchY);
      meshRef.current.scale.set(squashX, stretchY, squashX);
      
      // Face direction
      const targetRotation = facingRight.current ? 0 : Math.PI;
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation, 0.3);
    }
    
    // 2.5D Camera - side view following player
    const targetCamX = pos.x;
    const targetCamY = Math.max(pos.y + 3, 5);
    
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.05);
    camera.position.z = 25;
    camera.lookAt(camera.position.x, camera.position.y - 2, 0);
  });
  
  return (
    <>
      {/* ===== PLAYER ===== */}
      <group ref={meshRef}>
        {/* Body */}
        <mesh castShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.5, 0.6, 8, 16]} />
          <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.3} />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[0.2, 0.4, 0.45]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.2, 0.4, 0.45]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Pupils */}
        <mesh position={[0.25, 0.4, 0.55]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        <mesh position={[-0.15, 0.4, 0.55]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
      </group>
      
      <RigidBody ref={playerRef} position={[-15, 3, 0]} colliders={false} lockRotations gravityScale={2.5}>
        <CapsuleCollider args={[0.3, 0.5]} />
      </RigidBody>
      
      {/* ===== GROUND ===== */}
      <RigidBody type="fixed" position={[-20, -0.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[30, 1, 6]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </RigidBody>
      
      {/* Gap section */}
      <RigidBody type="fixed" position={[20, -0.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[25, 1, 6]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" position={[55, -0.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[40, 1, 6]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </RigidBody>
      
      {/* ===== PLATFORMS ===== */}
      {/* Starting area */}
      <RigidBody type="fixed" position={[-8, 2.5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[5, 0.5, 4]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" position={[-2, 4.5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4, 0.5, 4]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </RigidBody>
      
      {/* Jump challenge section */}
      <RigidBody type="fixed" position={[5, 3, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.5, 4]} />
          <meshStandardMaterial color="#8b5cf6" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" position={[12, 5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.5, 4]} />
          <meshStandardMaterial color="#8b5cf6" />
        </mesh>
      </RigidBody>
      
      {/* Moving platforms */}
      <MovingPlatform startPos={[18, 4, 0]} endPos={[24, 8, 0]} speed={1.5} />
      <MovingPlatform startPos={[30, 6, 0]} endPos={[30, 10, 0]} speed={2} />
      
      {/* Upper route */}
      <RigidBody type="fixed" position={[38, 8, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6, 0.5, 4]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" position={[48, 6, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[5, 0.5, 4]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" position={[58, 4, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6, 0.5, 4]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </RigidBody>
      
      {/* ===== HAZARDS ===== */}
      <Spikes position={[0, 0, 0]} width={4} />
      <Spikes position={[42, 0, 0]} width={3} />
      
      {/* ===== COLLECTIBLES ===== */}
      <Coin position={[-8, 4.5, 0]} />
      <Coin position={[-2, 6.5, 0]} />
      <Coin position={[5, 5, 0]} />
      <Coin position={[12, 7, 0]} />
      <Coin position={[21, 7, 0]} />
      <Coin position={[30, 12, 0]} />
      <Coin position={[38, 10, 0]} />
      <Coin position={[48, 8, 0]} />
      <Coin position={[58, 6, 0]} />
      
      {/* ===== GOAL ===== */}
      <group position={[70, 2, 0]}>
        {/* Flag pole */}
        <mesh castShadow position={[0, 3, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 6, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Flag */}
        <mesh castShadow position={[0.8, 5, 0]}>
          <boxGeometry args={[1.5, 1, 0.1]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
        </mesh>
        {/* Base */}
        <mesh castShadow position={[0, 0.25, 0]}>
          <boxGeometry args={[1, 0.5, 1]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        {/* Glow */}
        <pointLight position={[0, 4, 0]} color="#fbbf24" intensity={2} distance={10} />
      </group>
      
      {/* ===== BACKGROUND ===== */}
      {/* Sky gradient */}
      <mesh position={[30, 15, -50]}>
        <planeGeometry args={[200, 60]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      
      {/* Parallax buildings - back layer */}
      <ParallaxLayer 
        z={-40} 
        color="#1e293b"
        elements={[[-30, 10, 0], [-10, 15, 0], [10, 8, 0], [30, 12, 0], [50, 18, 0], [70, 10, 0]]}
      />
      
      {/* Parallax buildings - mid layer */}
      <ParallaxLayer 
        z={-25} 
        color="#334155"
        elements={[[-25, 8, 0], [0, 12, 0], [25, 6, 0], [45, 10, 0], [65, 14, 0]]}
      />
      
      {/* Stars/particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <mesh key={i} position={[(Math.random() - 0.5) * 150, 20 + Math.random() * 30, -45]}>
          <sphereGeometry args={[0.1, 4, 4]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      
      {/* Moon */}
      <mesh position={[60, 40, -48]}>
        <circleGeometry args={[5, 32]} />
        <meshBasicMaterial color="#fef3c7" />
      </mesh>
      
      {/* ===== LIGHTING ===== */}
      <ambientLight intensity={0.3} color="#a5b4fc" />
      <directionalLight
        position={[30, 30, 20]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#c7d2fe"
      />
      
      {/* Accent lights */}
      <pointLight position={[-15, 5, 5]} color="#ec4899" intensity={0.5} distance={15} />
      <pointLight position={[30, 10, 5]} color="#8b5cf6" intensity={0.5} distance={15} />
      <pointLight position={[60, 8, 5]} color="#22c55e" intensity={0.5} distance={15} />
    </>
  );
};

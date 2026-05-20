import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';

// Base animal interface
interface BaseAnimalProps {
  position?: [number, number, number];
  animate?: boolean;
  wanderRadius?: number;
}

// ========== PIG ==========
export const MinecraftPig = ({ 
  position = [0, 0, 0], 
  animate = true,
  wanderRadius = 4 
}: BaseAnimalProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const frontLeftLeg = useRef<THREE.Group>(null);
  const frontRightLeg = useRef<THREE.Group>(null);
  const backLeftLeg = useRef<THREE.Group>(null);
  const backRightLeg = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(Math.random() * 3);
  const isWalking = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current || !animate) return;
    const t = state.clock.elapsedTime;

    // Wandering behavior
    waitTime.current -= delta;
    if (waitTime.current <= 0) {
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 2 + Math.random() * 4;
    }

    const speed = 1.2 * delta;
    const dx = targetPos.current[0] - groupRef.current.position.x;
    const dz = targetPos.current[2] - groupRef.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      groupRef.current.position.x += (dx / dist) * speed;
      groupRef.current.position.z += (dz / dist) * speed;
      groupRef.current.rotation.y = Math.atan2(dx, dz);
      isWalking.current = true;
    } else {
      isWalking.current = false;
    }

    // Leg animation
    const walkAnim = isWalking.current ? Math.sin(t * 8) * 0.5 : 0;
    if (frontLeftLeg.current) frontLeftLeg.current.rotation.x = walkAnim;
    if (frontRightLeg.current) frontRightLeg.current.rotation.x = -walkAnim;
    if (backLeftLeg.current) backLeftLeg.current.rotation.x = -walkAnim;
    if (backRightLeg.current) backRightLeg.current.rotation.x = walkAnim;

    // Tail wag
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(t * 4) * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[0.6, 0.5, 0.9]} />
        <meshStandardMaterial color="#f0a0a0" />
      </mesh>
      
      {/* Head */}
      <mesh castShadow position={[0, 0.55, 0.5]}>
        <boxGeometry args={[0.45, 0.4, 0.4]} />
        <meshStandardMaterial color="#f0a0a0" />
      </mesh>
      
      {/* Snout */}
      <mesh castShadow position={[0, 0.45, 0.72]}>
        <boxGeometry args={[0.25, 0.2, 0.15]} />
        <meshStandardMaterial color="#ffb6b6" />
      </mesh>
      
      {/* Eyes */}
      <mesh position={[-0.12, 0.62, 0.7]}>
        <boxGeometry args={[0.06, 0.08, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.12, 0.62, 0.7]}>
        <boxGeometry args={[0.06, 0.08, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Ears */}
      <mesh castShadow position={[-0.18, 0.75, 0.45]}>
        <boxGeometry args={[0.12, 0.15, 0.08]} />
        <meshStandardMaterial color="#e89090" />
      </mesh>
      <mesh castShadow position={[0.18, 0.75, 0.45]}>
        <boxGeometry args={[0.12, 0.15, 0.08]} />
        <meshStandardMaterial color="#e89090" />
      </mesh>
      
      {/* Legs */}
      <group ref={frontLeftLeg} position={[-0.2, 0.25, 0.3]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <boxGeometry args={[0.15, 0.25, 0.15]} />
          <meshStandardMaterial color="#f0a0a0" />
        </mesh>
      </group>
      <group ref={frontRightLeg} position={[0.2, 0.25, 0.3]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <boxGeometry args={[0.15, 0.25, 0.15]} />
          <meshStandardMaterial color="#f0a0a0" />
        </mesh>
      </group>
      <group ref={backLeftLeg} position={[-0.2, 0.25, -0.3]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <boxGeometry args={[0.15, 0.25, 0.15]} />
          <meshStandardMaterial color="#f0a0a0" />
        </mesh>
      </group>
      <group ref={backRightLeg} position={[0.2, 0.25, -0.3]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <boxGeometry args={[0.15, 0.25, 0.15]} />
          <meshStandardMaterial color="#f0a0a0" />
        </mesh>
      </group>
      
      {/* Tail */}
      <mesh ref={tailRef} castShadow position={[0, 0.55, -0.48]}>
        <boxGeometry args={[0.08, 0.08, 0.12]} />
        <meshStandardMaterial color="#ffb6b6" />
      </mesh>
    </group>
  );
};

// ========== CHICKEN ==========
export const MinecraftChicken = ({ 
  position = [0, 0, 0], 
  animate = true,
  wanderRadius = 3 
}: BaseAnimalProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftWing = useRef<THREE.Mesh>(null);
  const rightWing = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(Math.random() * 2);
  const isWalking = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current || !animate) return;
    const t = state.clock.elapsedTime;

    waitTime.current -= delta;
    if (waitTime.current <= 0) {
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 1 + Math.random() * 3;
    }

    const speed = 1.5 * delta;
    const dx = targetPos.current[0] - groupRef.current.position.x;
    const dz = targetPos.current[2] - groupRef.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      groupRef.current.position.x += (dx / dist) * speed;
      groupRef.current.position.z += (dz / dist) * speed;
      groupRef.current.rotation.y = Math.atan2(dx, dz);
      isWalking.current = true;
    } else {
      isWalking.current = false;
    }

    // Leg animation
    const walkAnim = isWalking.current ? Math.sin(t * 10) * 0.6 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = walkAnim;
    if (rightLeg.current) rightLeg.current.rotation.x = -walkAnim;

    // Wing flap
    if (leftWing.current && rightWing.current) {
      const flapAnim = Math.sin(t * 6) * 0.1;
      leftWing.current.rotation.z = 0.1 + flapAnim;
      rightWing.current.rotation.z = -0.1 - flapAnim;
    }

    // Head bob
    if (headRef.current && isWalking.current) {
      headRef.current.position.z = 0.25 + Math.sin(t * 10) * 0.03;
      headRef.current.rotation.x = Math.sin(t * 10) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[0.35, 0.35, 0.5]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      
      {/* Head */}
      <group ref={headRef} position={[0, 0.55, 0.25]}>
        <mesh castShadow>
          <boxGeometry args={[0.25, 0.25, 0.2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Beak */}
        <mesh castShadow position={[0, -0.03, 0.12]}>
          <boxGeometry args={[0.1, 0.08, 0.08]} />
          <meshStandardMaterial color="#ff8c00" />
        </mesh>
        
        {/* Comb */}
        <mesh castShadow position={[0, 0.18, 0.03]}>
          <boxGeometry args={[0.06, 0.12, 0.1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
        
        {/* Wattle */}
        <mesh castShadow position={[0, -0.08, 0.08]}>
          <boxGeometry args={[0.06, 0.1, 0.04]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[-0.08, 0.05, 0.1]}>
          <boxGeometry args={[0.04, 0.04, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.08, 0.05, 0.1]}>
          <boxGeometry args={[0.04, 0.04, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      
      {/* Wings */}
      <mesh ref={leftWing} castShadow position={[-0.22, 0.35, 0]}>
        <boxGeometry args={[0.08, 0.25, 0.35]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
      <mesh ref={rightWing} castShadow position={[0.22, 0.35, 0]}>
        <boxGeometry args={[0.08, 0.25, 0.35]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
      
      {/* Legs */}
      <group ref={leftLeg} position={[-0.1, 0.18, 0]}>
        <mesh castShadow position={[0, -0.08, 0]}>
          <boxGeometry args={[0.05, 0.18, 0.05]} />
          <meshStandardMaterial color="#ff8c00" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.1, 0.18, 0]}>
        <mesh castShadow position={[0, -0.08, 0]}>
          <boxGeometry args={[0.05, 0.18, 0.05]} />
          <meshStandardMaterial color="#ff8c00" />
        </mesh>
      </group>
      
      {/* Tail feathers */}
      <mesh castShadow position={[0, 0.45, -0.28]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.2, 0.2, 0.08]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
    </group>
  );
};

// ========== COW ==========
export const MinecraftCow = ({ 
  position = [0, 0, 0], 
  animate = true,
  wanderRadius = 5 
}: BaseAnimalProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const frontLeftLeg = useRef<THREE.Group>(null);
  const frontRightLeg = useRef<THREE.Group>(null);
  const backLeftLeg = useRef<THREE.Group>(null);
  const backRightLeg = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(Math.random() * 4);
  const isWalking = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current || !animate) return;
    const t = state.clock.elapsedTime;

    waitTime.current -= delta;
    if (waitTime.current <= 0) {
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 3 + Math.random() * 5;
    }

    const speed = 1.0 * delta;
    const dx = targetPos.current[0] - groupRef.current.position.x;
    const dz = targetPos.current[2] - groupRef.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      groupRef.current.position.x += (dx / dist) * speed;
      groupRef.current.position.z += (dz / dist) * speed;
      groupRef.current.rotation.y = Math.atan2(dx, dz);
      isWalking.current = true;
    } else {
      isWalking.current = false;
    }

    // Leg animation
    const walkAnim = isWalking.current ? Math.sin(t * 6) * 0.4 : 0;
    if (frontLeftLeg.current) frontLeftLeg.current.rotation.x = walkAnim;
    if (frontRightLeg.current) frontRightLeg.current.rotation.x = -walkAnim;
    if (backLeftLeg.current) backLeftLeg.current.rotation.x = -walkAnim;
    if (backRightLeg.current) backRightLeg.current.rotation.x = walkAnim;

    // Tail swish
    if (tailRef.current) {
      tailRef.current.rotation.x = 0.3 + Math.sin(t * 3) * 0.2;
      tailRef.current.rotation.z = Math.sin(t * 2) * 0.3;
    }

    // Head grazing motion when idle
    if (headRef.current && !isWalking.current) {
      headRef.current.rotation.x = Math.sin(t * 0.5) * 0.1;
    } else if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0, 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh castShadow position={[0, 0.7, 0]}>
        <boxGeometry args={[0.8, 0.7, 1.3]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
      
      {/* White patches */}
      <mesh position={[-0.41, 0.7, 0.2]}>
        <boxGeometry args={[0.02, 0.4, 0.5]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.41, 0.7, -0.2]}>
        <boxGeometry args={[0.02, 0.35, 0.4]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      
      {/* Head */}
      <group ref={headRef} position={[0, 0.85, 0.75]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.45, 0.4]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
        
        {/* Snout */}
        <mesh castShadow position={[0, -0.1, 0.22]}>
          <boxGeometry args={[0.35, 0.25, 0.1]} />
          <meshStandardMaterial color="#d4a574" />
        </mesh>
        
        {/* Nostrils */}
        <mesh position={[-0.08, -0.08, 0.28]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[0.08, -0.08, 0.28]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[-0.15, 0.08, 0.2]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.15, 0.08, 0.2]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        
        {/* Horns */}
        <mesh castShadow position={[-0.22, 0.25, 0]}>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#d4c4b0" />
        </mesh>
        <mesh castShadow position={[0.22, 0.25, 0]}>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#d4c4b0" />
        </mesh>
        
        {/* Ears */}
        <mesh castShadow position={[-0.28, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.12, 0.2]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
        <mesh castShadow position={[0.28, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.12, 0.2]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>
      
      {/* Legs */}
      <group ref={frontLeftLeg} position={[-0.28, 0.35, 0.45]}>
        <mesh castShadow position={[0, -0.17, 0]}>
          <boxGeometry args={[0.2, 0.35, 0.2]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>
      <group ref={frontRightLeg} position={[0.28, 0.35, 0.45]}>
        <mesh castShadow position={[0, -0.17, 0]}>
          <boxGeometry args={[0.2, 0.35, 0.2]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>
      <group ref={backLeftLeg} position={[-0.28, 0.35, -0.45]}>
        <mesh castShadow position={[0, -0.17, 0]}>
          <boxGeometry args={[0.2, 0.35, 0.2]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>
      <group ref={backRightLeg} position={[0.28, 0.35, -0.45]}>
        <mesh castShadow position={[0, -0.17, 0]}>
          <boxGeometry args={[0.2, 0.35, 0.2]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>
      
      {/* Udder */}
      <mesh castShadow position={[0, 0.35, -0.3]}>
        <boxGeometry args={[0.25, 0.15, 0.2]} />
        <meshStandardMaterial color="#ffb6b6" />
      </mesh>
      
      {/* Tail */}
      <group ref={tailRef} position={[0, 0.85, -0.68]}>
        <mesh castShadow position={[0, -0.2, -0.05]}>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
        <mesh castShadow position={[0, -0.42, -0.05]}>
          <boxGeometry args={[0.1, 0.12, 0.1]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      </group>
    </group>
  );
};

// ========== SHEEP ==========
export const MinecraftSheep = ({ 
  position = [0, 0, 0], 
  animate = true,
  wanderRadius = 4 
}: BaseAnimalProps & { woolColor?: string }) => {
  const groupRef = useRef<THREE.Group>(null);
  const frontLeftLeg = useRef<THREE.Group>(null);
  const frontRightLeg = useRef<THREE.Group>(null);
  const backLeftLeg = useRef<THREE.Group>(null);
  const backRightLeg = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(Math.random() * 3);
  const isWalking = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current || !animate) return;
    const t = state.clock.elapsedTime;

    waitTime.current -= delta;
    if (waitTime.current <= 0) {
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 2 + Math.random() * 4;
    }

    const speed = 1.1 * delta;
    const dx = targetPos.current[0] - groupRef.current.position.x;
    const dz = targetPos.current[2] - groupRef.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      groupRef.current.position.x += (dx / dist) * speed;
      groupRef.current.position.z += (dz / dist) * speed;
      groupRef.current.rotation.y = Math.atan2(dx, dz);
      isWalking.current = true;
    } else {
      isWalking.current = false;
    }

    // Leg animation
    const walkAnim = isWalking.current ? Math.sin(t * 7) * 0.45 : 0;
    if (frontLeftLeg.current) frontLeftLeg.current.rotation.x = walkAnim;
    if (frontRightLeg.current) frontRightLeg.current.rotation.x = -walkAnim;
    if (backLeftLeg.current) backLeftLeg.current.rotation.x = -walkAnim;
    if (backRightLeg.current) backRightLeg.current.rotation.x = walkAnim;

    // Head movement - grazing
    if (headRef.current && !isWalking.current) {
      headRef.current.rotation.x = 0.2 + Math.sin(t * 0.8) * 0.15;
    } else if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0, 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Wool body */}
      <mesh castShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[0.7, 0.6, 0.9]} />
        <meshStandardMaterial color="#f5f5dc" />
      </mesh>
      
      {/* Head */}
      <group ref={headRef} position={[0, 0.65, 0.52]}>
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
        
        {/* Wool on top of head */}
        <mesh castShadow position={[0, 0.2, -0.05]}>
          <boxGeometry args={[0.4, 0.15, 0.3]} />
          <meshStandardMaterial color="#f5f5dc" />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[-0.1, 0.05, 0.18]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.1, 0.05, 0.18]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        
        {/* Ears */}
        <mesh castShadow position={[-0.2, 0.05, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.15]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
        <mesh castShadow position={[0.2, 0.05, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.15]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
      </group>
      
      {/* Legs */}
      <group ref={frontLeftLeg} position={[-0.22, 0.3, 0.3]}>
        <mesh castShadow position={[0, -0.15, 0]}>
          <boxGeometry args={[0.15, 0.3, 0.15]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
      </group>
      <group ref={frontRightLeg} position={[0.22, 0.3, 0.3]}>
        <mesh castShadow position={[0, -0.15, 0]}>
          <boxGeometry args={[0.15, 0.3, 0.15]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
      </group>
      <group ref={backLeftLeg} position={[-0.22, 0.3, -0.3]}>
        <mesh castShadow position={[0, -0.15, 0]}>
          <boxGeometry args={[0.15, 0.3, 0.15]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
      </group>
      <group ref={backRightLeg} position={[0.22, 0.3, -0.3]}>
        <mesh castShadow position={[0, -0.15, 0]}>
          <boxGeometry args={[0.15, 0.3, 0.15]} />
          <meshStandardMaterial color="#c4a574" />
        </mesh>
      </group>
    </group>
  );
};

// Static versions for editor/store (no wandering)
export const StaticMinecraftPig = ({ position = [0, 0, 0] }: { position?: [number, number, number] }) => (
  <MinecraftPig position={position} animate={true} wanderRadius={0} />
);

export const StaticMinecraftChicken = ({ position = [0, 0, 0] }: { position?: [number, number, number] }) => (
  <MinecraftChicken position={position} animate={true} wanderRadius={0} />
);

export const StaticMinecraftCow = ({ position = [0, 0, 0] }: { position?: [number, number, number] }) => (
  <MinecraftCow position={position} animate={true} wanderRadius={0} />
);

export const StaticMinecraftSheep = ({ position = [0, 0, 0] }: { position?: [number, number, number] }) => (
  <MinecraftSheep position={position} animate={true} wanderRadius={0} />
);

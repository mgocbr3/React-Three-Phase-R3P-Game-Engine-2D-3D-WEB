import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/editorStore';

interface MinecraftCharacterProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  skinColors?: {
    skin?: string;
    hair?: string;
    shirt?: string;
    pants?: string;
    shoes?: string;
  };
  animate?: boolean;
  animationSpeed?: number;
  scale?: number;
  isPlayer?: boolean;
}

// Classic Steve-like proportions
export const MinecraftCharacter = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  skinColors = {},
  animate = true,
  animationSpeed = 2,
  scale = 1,
  isPlayer = false,
}: MinecraftCharacterProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  
  // Check if we're in edit mode - all characters should be static in edit mode
  const isEditMode = useEditorStore((state) => state.isEditMode);

  const {
    skin = '#c4a574',
    hair = '#3d2314',
    shirt = '#00aaaa',
    pants = '#1a1a7a',
    shoes = '#4a4a4a',
  } = skinColors;

  useFrame((state) => {
    // Don't animate in edit mode OR if animate prop is false
    if (!animate || isEditMode) return;
    
    const t = state.clock.elapsedTime * animationSpeed;
    
    // Walking animation - strong arm and leg swings like Minecraft
    if (leftArmRef.current && rightArmRef.current) {
      // Arms swing opposite to legs, large amplitude for visibility
      leftArmRef.current.rotation.x = Math.sin(t) * 0.8;
      rightArmRef.current.rotation.x = Math.sin(t + Math.PI) * 0.8;
    }
    
    if (leftLegRef.current && rightLegRef.current) {
      // Legs swing with good amplitude for walking effect
      leftLegRef.current.rotation.x = Math.sin(t) * 0.6;
      rightLegRef.current.rotation.x = Math.sin(t + Math.PI) * 0.6;
    }

    // Slight head bob while walking
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
      headRef.current.position.y = 1.75 + Math.abs(Math.sin(t * 2)) * 0.03;
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={position} 
      rotation={rotation}
      scale={scale}
    >
      {/* Head - 8x8x8 pixels in Minecraft scale */}
      <mesh ref={headRef} castShadow position={[0, 1.75, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      
      {/* Hair on top */}
      <mesh castShadow position={[0, 2.05, 0]}>
        <boxGeometry args={[0.52, 0.12, 0.52]} />
        <meshStandardMaterial color={hair} />
      </mesh>
      
      {/* Hair on back */}
      <mesh castShadow position={[0, 1.85, -0.2]}>
        <boxGeometry args={[0.52, 0.35, 0.15]} />
        <meshStandardMaterial color={hair} />
      </mesh>

      {/* Face details - eyes */}
      <mesh position={[-0.12, 1.78, 0.251]}>
        <boxGeometry args={[0.08, 0.06, 0.01]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.12, 1.78, 0.251]}>
        <boxGeometry args={[0.08, 0.06, 0.01]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Pupils */}
      <mesh position={[-0.1, 1.78, 0.252]}>
        <boxGeometry args={[0.04, 0.04, 0.01]} />
        <meshStandardMaterial color="#3d2314" />
      </mesh>
      <mesh position={[0.14, 1.78, 0.252]}>
        <boxGeometry args={[0.04, 0.04, 0.01]} />
        <meshStandardMaterial color="#3d2314" />
      </mesh>
      
      {/* Mouth */}
      <mesh position={[0, 1.62, 0.251]}>
        <boxGeometry args={[0.15, 0.04, 0.01]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>

      {/* Body/Torso - 8x12x4 pixels */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[0.5, 0.75, 0.25]} />
        <meshStandardMaterial color={shirt} />
      </mesh>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.375, 1.35, 0]}>
        <mesh castShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[0.25, 0.75, 0.25]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        {/* Hand */}
        <mesh castShadow position={[0, -0.55, 0]}>
          <boxGeometry args={[0.22, 0.15, 0.22]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.375, 1.35, 0]}>
        <mesh castShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[0.25, 0.75, 0.25]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        {/* Hand */}
        <mesh castShadow position={[0, -0.55, 0]}>
          <boxGeometry args={[0.22, 0.15, 0.22]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>

      {/* Left Leg */}
      <group ref={leftLegRef} position={[-0.125, 0.55, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.25, 0.55, 0.25]} />
          <meshStandardMaterial color={pants} />
        </mesh>
        {/* Shoe */}
        <mesh castShadow position={[0, -0.5, 0.03]}>
          <boxGeometry args={[0.24, 0.12, 0.3]} />
          <meshStandardMaterial color={shoes} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group ref={rightLegRef} position={[0.125, 0.55, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.25, 0.55, 0.25]} />
          <meshStandardMaterial color={pants} />
        </mesh>
        {/* Shoe */}
        <mesh castShadow position={[0, -0.5, 0.03]}>
          <boxGeometry args={[0.24, 0.12, 0.3]} />
          <meshStandardMaterial color={shoes} />
        </mesh>
      </group>

      {/* Player indicator glow */}
      {isPlayer && (
        <pointLight position={[0, 2.5, 0]} intensity={0.3} distance={3} color="#22d3ee" />
      )}
    </group>
  );
};

// Voxel Tree
export const MinecraftTree = ({ position = [0, 0, 0] as [number, number, number] }) => {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <boxGeometry args={[0.6, 3, 0.6]} />
        <meshStandardMaterial color="#5c3d2e" />
      </mesh>
      
      {/* Leaves - layered boxes */}
      <mesh castShadow position={[0, 3.5, 0]}>
        <boxGeometry args={[2.5, 1, 2.5]} />
        <meshStandardMaterial color="#2d5a27" />
      </mesh>
      <mesh castShadow position={[0, 4.5, 0]}>
        <boxGeometry args={[2, 1, 2]} />
        <meshStandardMaterial color="#3a7233" />
      </mesh>
      <mesh castShadow position={[0, 5.3, 0]}>
        <boxGeometry args={[1.2, 0.8, 1.2]} />
        <meshStandardMaterial color="#4a8a43" />
      </mesh>
    </group>
  );
};

// Voxel House/Building
export const MinecraftHouse = ({ 
  position = [0, 0, 0] as [number, number, number],
  size = [6, 4, 5] as [number, number, number],
  wallColor = '#a08060',
  roofColor = '#8b4513'
}) => {
  return (
    <group position={position}>
      {/* Walls */}
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      
      {/* Roof */}
      <mesh castShadow position={[0, size[1] + 0.5, 0]}>
        <boxGeometry args={[size[0] + 0.5, 1, size[2] + 0.5]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      
      {/* Door */}
      <mesh position={[0, 1.25, size[2] / 2 + 0.01]}>
        <boxGeometry args={[1.2, 2.5, 0.1]} />
        <meshStandardMaterial color="#3d2314" />
      </mesh>
      
      {/* Windows */}
      <mesh position={[-1.8, 2.5, size[2] / 2 + 0.01]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[1.8, 2.5, size[2] / 2 + 0.01]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
};

// Voxel Ground Block with Physics
export const MinecraftGround = ({ 
  size = [64, 1, 64] as [number, number, number],
  position = [0, -0.5, 0] as [number, number, number]
}) => {
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CuboidCollider args={[size[0] / 2, 0.5, size[2] / 2]} position={[0, 0.2, 0]} />
      
      {/* Grass layer */}
      <mesh receiveShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[size[0], 0.2, size[2]]} />
        <meshStandardMaterial color="#4a8a43" />
      </mesh>
      
      {/* Dirt layer */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[size[0], 0.8, size[2]]} />
        <meshStandardMaterial color="#6b4423" />
      </mesh>
    </RigidBody>
  );
};

// Voxel Lamp Post
export const MinecraftLampPost = ({ position = [0, 0, 0] as [number, number, number] }) => {
  return (
    <group position={position}>
      {/* Post */}
      <mesh castShadow position={[0, 2, 0]}>
        <boxGeometry args={[0.3, 4, 0.3]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      
      {/* Lamp head */}
      <mesh castShadow position={[0, 4.3, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Glowstone */}
      <mesh position={[0, 4.3, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#ffeb3b" emissiveIntensity={2} />
      </mesh>
      
      <pointLight position={[0, 4.3, 0]} intensity={1} distance={12} color="#ffeb3b" />
    </group>
  );
};

// Voxel Fence
export const MinecraftFence = ({ 
  position = [0, 0, 0] as [number, number, number],
  length = 10
}) => {
  const posts = [];
  for (let i = 0; i < length; i++) {
    posts.push(
      <group key={i} position={[i * 1.5, 0, 0]}>
        <mesh castShadow position={[0, 0.75, 0]}>
          <boxGeometry args={[0.2, 1.5, 0.2]} />
          <meshStandardMaterial color="#8b7355" />
        </mesh>
        {i < length - 1 && (
          <>
            <mesh castShadow position={[0.75, 0.5, 0]}>
              <boxGeometry args={[1.3, 0.15, 0.1]} />
              <meshStandardMaterial color="#8b7355" />
            </mesh>
            <mesh castShadow position={[0.75, 1, 0]}>
              <boxGeometry args={[1.3, 0.15, 0.1]} />
              <meshStandardMaterial color="#8b7355" />
            </mesh>
          </>
        )}
      </group>
    );
  }
  
  return <group position={position}>{posts}</group>;
};

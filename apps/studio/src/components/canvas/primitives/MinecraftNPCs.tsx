import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MinecraftCharacter } from './MinecraftCharacter';
import { useEditorStore } from '@/stores/editorStore';

interface NPCProps {
  position?: [number, number, number];
  skinColors?: {
    skin?: string;
    hair?: string;
    shirt?: string;
    pants?: string;
    shoes?: string;
  };
  wanderRadius?: number;
  name?: string;
}

// Wandering NPC that moves around and animates
export const WanderingNPC = ({ 
  position = [0, 0, 0], 
  skinColors,
  wanderRadius = 3,
  name = 'NPC'
}: NPCProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(0);
  const isWalking = useRef(false);
  
  // Check if we're in edit mode - NPCs should be static in edit mode
  const isEditMode = useEditorStore((state) => state.isEditMode);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Don't move or animate in edit mode - stay static for easier selection
    if (isEditMode) {
      return;
    }

    waitTime.current -= delta;
    
    if (waitTime.current <= 0) {
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 2 + Math.random() * 3;
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
  });

  return (
    <group ref={groupRef} position={position}>
      <MinecraftCharacter 
        skinColors={skinColors}
        animate={!isEditMode} // Don't animate in edit mode
        animationSpeed={4}
      />
    </group>
  );
};

// Villager NPC with profession-based appearance
export const MinecraftVillager = ({ 
  position = [0, 0, 0],
  profession = 'farmer'
}: { 
  position?: [number, number, number];
  profession?: 'farmer' | 'blacksmith' | 'librarian' | 'priest' | 'butcher';
}) => {
  const professionColors = {
    farmer: { shirt: '#8B4513', pants: '#654321', hair: '#5c4033' },
    blacksmith: { shirt: '#2f2f2f', pants: '#1a1a1a', hair: '#3d3d3d' },
    librarian: { shirt: '#ffffff', pants: '#4a4a4a', hair: '#8b8b8b' },
    priest: { shirt: '#800080', pants: '#4b0082', hair: '#1a1a1a' },
    butcher: { shirt: '#ffffff', pants: '#8b0000', hair: '#a0522d' },
  };

  const colors = professionColors[profession];

  return (
    <WanderingNPC 
      position={position}
      skinColors={{
        skin: '#c4a574',
        hair: colors.hair,
        shirt: colors.shirt,
        pants: colors.pants,
        shoes: '#2a2a2a'
      }}
      wanderRadius={4}
      name={`${profession.charAt(0).toUpperCase() + profession.slice(1)}`}
    />
  );
};

// Guard NPC with armor appearance
export const MinecraftGuard = ({ 
  position = [0, 0, 0],
  patrolRadius = 5
}: { 
  position?: [number, number, number];
  patrolRadius?: number;
}) => {
  return (
    <WanderingNPC 
      position={position}
      skinColors={{
        skin: '#c4a574',
        hair: '#3d2314',
        shirt: '#808080', // armor color
        pants: '#606060',
        shoes: '#4a4a4a'
      }}
      wanderRadius={patrolRadius}
      name="Guard"
    />
  );
};

// Merchant NPC - stays in place
export const MinecraftMerchant = ({ 
  position = [0, 0, 0],
  rotation = 0
}: { 
  position?: [number, number, number];
  rotation?: number;
}) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <MinecraftCharacter 
        skinColors={{
          skin: '#deb887',
          hair: '#8b4513',
          shirt: '#daa520',
          pants: '#8b4513',
          shoes: '#654321'
        }}
        animate={true}
        animationSpeed={0.5}
      />
    </group>
  );
};

// Enemy NPC types
export const MinecraftZombie = ({ 
  position = [0, 0, 0],
  wanderRadius = 6
}: { 
  position?: [number, number, number];
  wanderRadius?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(0);
  
  const isEditMode = useEditorStore((state) => state.isEditMode);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Static in edit mode
    if (isEditMode) return;

    waitTime.current -= delta;
    
    if (waitTime.current <= 0) {
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 1 + Math.random() * 2;
    }

    const speed = 0.8 * delta; // Slower movement
    const dx = targetPos.current[0] - groupRef.current.position.x;
    const dz = targetPos.current[2] - groupRef.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      groupRef.current.position.x += (dx / dist) * speed;
      groupRef.current.position.z += (dz / dist) * speed;
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <MinecraftCharacter 
        skinColors={{
          skin: '#4a7c4e', // green skin
          hair: '#2d4f30',
          shirt: '#3d5c40',
          pants: '#2d4f30',
          shoes: '#1a2e1c'
        }}
        animate={!isEditMode}
        animationSpeed={2}
      />
    </group>
  );
};

export const MinecraftSkeleton = ({ 
  position = [0, 0, 0],
  wanderRadius = 5
}: { 
  position?: [number, number, number];
  wanderRadius?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(0);
  
  const isEditMode = useEditorStore((state) => state.isEditMode);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Static in edit mode
    if (isEditMode) return;

    waitTime.current -= delta;
    
    if (waitTime.current <= 0) {
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 1.5 + Math.random() * 2;
    }

    const speed = 1.0 * delta;
    const dx = targetPos.current[0] - groupRef.current.position.x;
    const dz = targetPos.current[2] - groupRef.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      groupRef.current.position.x += (dx / dist) * speed;
      groupRef.current.position.z += (dz / dist) * speed;
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <MinecraftCharacter 
        skinColors={{
          skin: '#e8e8d0', // bone color
          hair: '#e8e8d0',
          shirt: '#d8d8c0',
          pants: '#d0d0b8',
          shoes: '#c8c8b0'
        }}
        animate={!isEditMode}
        animationSpeed={3}
      />
    </group>
  );
};

// Static NPC for stores/editor (no wandering)
export const StaticMinecraftNPC = ({ 
  position = [0, 0, 0],
  skinColors,
  rotation = 0
}: { 
  position?: [number, number, number];
  skinColors?: NPCProps['skinColors'];
  rotation?: number;
}) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <MinecraftCharacter 
        skinColors={skinColors}
        animate={true}
        animationSpeed={0.5}
      />
    </group>
  );
};

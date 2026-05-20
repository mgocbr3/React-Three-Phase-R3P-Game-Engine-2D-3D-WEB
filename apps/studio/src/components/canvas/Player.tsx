import { useRef } from 'react';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

interface PlayerProps {
  position?: [number, number, number];
  color?: string;
}

export const Player = ({ position = [0, 3, 0], color = '#a855f7' }: PlayerProps) => {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={position}
      colliders={false}
      lockRotations
      enabledRotations={[false, true, false]}
    >
      <CapsuleCollider args={[0.5, 0.5]} />
      <mesh ref={meshRef} castShadow>
        <capsuleGeometry args={[0.5, 1, 8, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Head indicator */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
    </RigidBody>
  );
};

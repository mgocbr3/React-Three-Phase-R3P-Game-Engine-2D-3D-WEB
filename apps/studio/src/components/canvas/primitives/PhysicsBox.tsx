import { RigidBody } from '@react-three/rapier';

interface PhysicsBoxProps {
  position?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  mass?: number;
}

export const PhysicsBox = ({ 
  position = [0, 2, 0], 
  size = [1, 1, 1],
  color = '#a855f7',
  mass = 1
}: PhysicsBoxProps) => {
  return (
    <RigidBody position={position} mass={mass} restitution={0.3}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={0.1}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
    </RigidBody>
  );
};

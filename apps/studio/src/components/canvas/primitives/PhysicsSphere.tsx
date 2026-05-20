import { RigidBody } from '@react-three/rapier';

interface PhysicsSphereProps {
  position?: [number, number, number];
  radius?: number;
  color?: string;
  mass?: number;
}

export const PhysicsSphere = ({ 
  position = [0, 2, 0], 
  radius = 0.5,
  color = '#22d3ee',
  mass = 1
}: PhysicsSphereProps) => {
  return (
    <RigidBody position={position} mass={mass} restitution={0.8} colliders="ball">
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
    </RigidBody>
  );
};

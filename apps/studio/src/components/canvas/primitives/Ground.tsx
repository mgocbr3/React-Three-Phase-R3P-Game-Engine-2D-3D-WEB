import { RigidBody } from '@react-three/rapier';

interface GroundProps {
  size?: [number, number];
  color?: string;
  position?: [number, number, number];
}

export const Ground = ({ 
  size = [100, 100], 
  color = '#1a1a2e',
  position = [0, 0, 0]
}: GroundProps) => {
  return (
    <RigidBody type="fixed" position={position}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial 
          color={color}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
    </RigidBody>
  );
};

import { RigidBody } from '@react-three/rapier';

interface PlatformProps {
  position?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  isMoving?: boolean;
}

export const Platform = ({ 
  position = [0, 1, 0], 
  size = [4, 0.5, 4],
  color = '#2d2d44',
  isMoving = false
}: PlatformProps) => {
  return (
    <RigidBody type="fixed" position={position}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial 
          color={color}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      {/* Edge glow */}
      <mesh position={[0, size[1] / 2 + 0.01, 0]}>
        <boxGeometry args={[size[0] + 0.05, 0.02, size[2] + 0.05]} />
        <meshStandardMaterial 
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.5}
        />
      </mesh>
    </RigidBody>
  );
};

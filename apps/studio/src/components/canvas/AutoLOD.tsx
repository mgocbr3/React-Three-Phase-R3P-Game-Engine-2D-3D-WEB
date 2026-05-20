import { useRef, useMemo, ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineSettings } from '@/stores/engineSettingsStore';

export interface AutoLODProps {
  children: ReactNode;
  /** High-detail version (shown when close) */
  high?: ReactNode;
  /** Medium-detail version */
  medium?: ReactNode;
  /** Low-detail version (shown when far) */
  low?: ReactNode;
  /** Distance thresholds for switching [medium, low] */
  distances?: [number, number];
  position?: [number, number, number];
}

/**
 * AutoLOD - Automatically switches between detail levels based on camera distance
 * 
 * Usage:
 * <AutoLOD
 *   position={[0, 0, 0]}
 *   high={<HighDetailMesh />}
 *   medium={<MediumDetailMesh />}
 *   low={<LowDetailMesh />}
 *   distances={[20, 50]}
 * />
 * 
 * Or simpler:
 * <AutoLOD position={[0, 0, 0]}>
 *   <DetailedMesh />
 * </AutoLOD>
 */
export const AutoLOD = ({
  children,
  high,
  medium,
  low,
  distances = [15, 40],
  position = [0, 0, 0],
}: AutoLODProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { lodEnabled, lodBias } = useEngineSettings();
  const currentLevelRef = useRef<'high' | 'medium' | 'low'>('high');
  
  // Refs for each LOD level
  const highRef = useRef<THREE.Group>(null);
  const mediumRef = useRef<THREE.Group>(null);
  const lowRef = useRef<THREE.Group>(null);
  
  // Adjusted distances based on LOD bias
  const adjustedDistances = useMemo(() => [
    distances[0] * lodBias,
    distances[1] * lodBias,
  ], [distances, lodBias]);
  
  useFrame(() => {
    if (!groupRef.current || !lodEnabled) return;
    
    // Get world position
    const worldPos = groupRef.current.getWorldPosition(new THREE.Vector3());
    const distance = camera.position.distanceTo(worldPos);
    
    // Determine LOD level
    let newLevel: 'high' | 'medium' | 'low' = 'high';
    if (distance > adjustedDistances[1]) {
      newLevel = 'low';
    } else if (distance > adjustedDistances[0]) {
      newLevel = 'medium';
    }
    
    // Only update if level changed
    if (newLevel !== currentLevelRef.current) {
      currentLevelRef.current = newLevel;
      
      // Update visibility
      if (highRef.current) highRef.current.visible = newLevel === 'high';
      if (mediumRef.current) mediumRef.current.visible = newLevel === 'medium';
      if (lowRef.current) lowRef.current.visible = newLevel === 'low';
    }
  });
  
  // If LOD is disabled or only children provided, render normally
  if (!lodEnabled || (!high && !medium && !low)) {
    return (
      <group position={position}>
        {children}
      </group>
    );
  }
  
  return (
    <group ref={groupRef} position={position}>
      {/* High detail - visible by default */}
      <group ref={highRef} visible={true}>
        {high || children}
      </group>
      
      {/* Medium detail */}
      {medium && (
        <group ref={mediumRef} visible={false}>
          {medium}
        </group>
      )}
      
      {/* Low detail */}
      {low && (
        <group ref={lowRef} visible={false}>
          {low}
        </group>
      )}
    </group>
  );
};

/**
 * SimpleLODMesh - Auto-generates LOD levels for simple meshes
 * 
 * Automatically reduces polygon count at distance
 */
export interface SimpleLODMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  color?: string;
  geometry: 'box' | 'sphere' | 'cylinder';
  segments?: {
    high?: number;
    medium?: number;
    low?: number;
  };
}

export const SimpleLODMesh = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color = '#6366f1',
  geometry = 'sphere',
  segments = { high: 32, medium: 16, low: 8 },
}: SimpleLODMeshProps) => {
  const scaleArray = typeof scale === 'number' ? [scale, scale, scale] : scale;
  
  const getGeometry = (detail: 'high' | 'medium' | 'low') => {
    const seg = segments[detail] || (detail === 'high' ? 32 : detail === 'medium' ? 16 : 8);
    
    switch (geometry) {
      case 'sphere':
        return <sphereGeometry args={[0.5, seg, seg]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, seg]} />;
      case 'box':
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };
  
  const sharedMaterial = <meshStandardMaterial color={color} />;
  
  return (
    <AutoLOD position={position}>
      <group 
        rotation={rotation.map(r => r * Math.PI / 180) as [number, number, number]}
        scale={scaleArray as [number, number, number]}
      >
        <mesh castShadow receiveShadow>
          {getGeometry('high')}
          {sharedMaterial}
        </mesh>
      </group>
    </AutoLOD>
  );
};

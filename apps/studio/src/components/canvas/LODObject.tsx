import { useRef, ReactNode, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface LODLevel {
  distance: number;
  children: ReactNode;
}

export interface LODObjectProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  levels: LODLevel[];
  // Optional: use Three.js LOD (better performance for many objects)
  useNativeLOD?: boolean;
}

/**
 * LODObject - Renders different detail levels based on camera distance
 * 
 * Usage:
 * <LODObject
 *   position={[0, 0, 0]}
 *   levels={[
 *     { distance: 0, children: <HighDetailModel /> },
 *     { distance: 10, children: <MediumDetailModel /> },
 *     { distance: 30, children: <LowDetailModel /> },
 *     { distance: 100, children: <BillboardSprite /> },
 *   ]}
 * />
 */
export const LODObject = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  levels,
  useNativeLOD = false,
}: LODObjectProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const currentLevelRef = useRef(0);
  
  // Sort levels by distance (ascending)
  const sortedLevels = useMemo(() => {
    return [...levels].sort((a, b) => a.distance - b.distance);
  }, [levels]);
  
  useFrame(() => {
    if (!groupRef.current || useNativeLOD) return;
    
    // Calculate distance to camera
    const worldPos = groupRef.current.getWorldPosition(new THREE.Vector3());
    const distance = camera.position.distanceTo(worldPos);
    
    // Find appropriate LOD level
    let newLevel = 0;
    for (let i = sortedLevels.length - 1; i >= 0; i--) {
      if (distance >= sortedLevels[i].distance) {
        newLevel = i;
        break;
      }
    }
    
    // Only update if level changed
    if (newLevel !== currentLevelRef.current) {
      currentLevelRef.current = newLevel;
      
      // Update visibility of children
      groupRef.current.children.forEach((child, index) => {
        child.visible = index === newLevel;
      });
    }
  });
  
  const scaleArray = typeof scale === 'number' ? [scale, scale, scale] : scale;
  
  // Native LOD is handled the same way since <lod> doesn't exist in JSX
  // useNativeLOD is kept for future Three.js LOD integration
  
  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation.map(r => r * Math.PI / 180) as [number, number, number]}
      scale={scaleArray as [number, number, number]}
    >
      {sortedLevels.map((level, index) => (
        <group key={index} visible={index === 0}>
          {level.children}
        </group>
      ))}
    </group>
  );
};

// Simple LOD wrapper using drei's Detailed component concept
export interface SimpleLODProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  distances: number[];
  children: ReactNode[];
}

export const SimpleLOD = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  distances,
  children,
}: SimpleLODProps) => {
  const levels = useMemo(() => {
    const childArray = Array.isArray(children) ? children : [children];
    return childArray.map((child, index) => ({
      distance: distances[index] || index * 20,
      children: child,
    }));
  }, [children, distances]);
  
  return (
    <LODObject
      position={position}
      rotation={rotation}
      scale={scale}
      levels={levels}
    />
  );
};

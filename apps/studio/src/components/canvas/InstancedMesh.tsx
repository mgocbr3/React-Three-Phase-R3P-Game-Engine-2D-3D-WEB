import { useRef, useEffect, useMemo, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface InstanceData {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  color?: string;
}

export interface InstancedMeshProps {
  instances: InstanceData[];
  // Geometry
  geometry?: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus';
  geometryArgs?: number[];
  // Material
  color?: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  // Rendering
  castShadow?: boolean;
  receiveShadow?: boolean;
  // Custom geometry/material
  children?: ReactNode;
  // Animation callback
  onUpdate?: (mesh: THREE.InstancedMesh, instances: InstanceData[], time: number) => void;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

/**
 * InstancedMesh - Efficiently render thousands of identical meshes
 * 
 * Usage:
 * <InstancedMesh
 *   instances={[
 *     { id: '1', position: [0, 0, 0], scale: 1, color: '#ff0000' },
 *     { id: '2', position: [5, 0, 0], scale: 2, color: '#00ff00' },
 *     // ... thousands more
 *   ]}
 *   geometry="sphere"
 *   geometryArgs={[0.5, 16, 16]}
 * />
 */
export const InstancedMesh = ({
  instances,
  geometry = 'box',
  geometryArgs = [1, 1, 1],
  color = '#ffffff',
  metalness = 0,
  roughness = 1,
  emissive = '#000000',
  emissiveIntensity = 0,
  castShadow = true,
  receiveShadow = true,
  children,
  onUpdate,
}: InstancedMeshProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hasPerInstanceColor = instances.some(i => i.color);
  
  // Create geometry based on type
  const geometryNode = useMemo(() => {
    switch (geometry) {
      case 'sphere':
        return <sphereGeometry args={geometryArgs as [number, number, number]} />;
      case 'cylinder':
        return <cylinderGeometry args={geometryArgs as [number, number, number, number]} />;
      case 'cone':
        return <coneGeometry args={geometryArgs as [number, number, number]} />;
      case 'torus':
        return <torusGeometry args={geometryArgs as [number, number, number, number]} />;
      case 'box':
      default:
        return <boxGeometry args={geometryArgs as [number, number, number]} />;
    }
  }, [geometry, geometryArgs]);
  
  // Update instance matrices and colors
  useEffect(() => {
    if (!meshRef.current) return;
    
    const mesh = meshRef.current;
    
    instances.forEach((instance, i) => {
      // Position
      tempObject.position.set(...instance.position);
      
      // Rotation
      if (instance.rotation) {
        tempObject.rotation.set(
          instance.rotation[0] * Math.PI / 180,
          instance.rotation[1] * Math.PI / 180,
          instance.rotation[2] * Math.PI / 180
        );
      } else {
        tempObject.rotation.set(0, 0, 0);
      }
      
      // Scale
      if (instance.scale) {
        const s = typeof instance.scale === 'number' 
          ? [instance.scale, instance.scale, instance.scale] as [number, number, number]
          : instance.scale;
        tempObject.scale.set(s[0], s[1], s[2]);
      } else {
        tempObject.scale.set(1, 1, 1);
      }
      
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
      
      // Color
      if (hasPerInstanceColor && instance.color) {
        tempColor.set(instance.color);
        mesh.setColorAt(i, tempColor);
      }
    });
    
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [instances, hasPerInstanceColor]);
  
  // Optional animation callback
  useFrame(({ clock }) => {
    if (onUpdate && meshRef.current) {
      onUpdate(meshRef.current, instances, clock.elapsedTime);
    }
  });
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, instances.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children || (
        <>
          {geometryNode}
          <meshStandardMaterial
            color={color}
            metalness={metalness}
            roughness={roughness}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
          />
        </>
      )}
    </instancedMesh>
  );
};

// Helper hook for generating instance data
export const useInstanceData = (count: number, generator: (index: number) => Omit<InstanceData, 'id'>) => {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: `instance-${i}`,
      ...generator(i),
    }));
  }, [count, generator]);
};

// Preset generators for common patterns
export const instanceGenerators = {
  // Grid pattern
  grid: (cols: number, rows: number, spacing: number) => (index: number): Omit<InstanceData, 'id'> => {
    const x = (index % cols) * spacing - (cols * spacing) / 2;
    const z = Math.floor(index / cols) * spacing - (rows * spacing) / 2;
    return { position: [x, 0, z] };
  },
  
  // Random scatter
  scatter: (radius: number, yRange: [number, number] = [0, 0]) => (): Omit<InstanceData, 'id'> => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
    return { 
      position: [x, y, z],
      rotation: [0, Math.random() * 360, 0],
      scale: 0.5 + Math.random() * 0.5,
    };
  },
  
  // Spiral pattern
  spiral: (turns: number, radius: number, height: number) => (index: number, total: number): Omit<InstanceData, 'id'> => {
    const t = index / total;
    const angle = t * turns * Math.PI * 2;
    const r = t * radius;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = t * height;
    return { position: [x, y, z] };
  },
};

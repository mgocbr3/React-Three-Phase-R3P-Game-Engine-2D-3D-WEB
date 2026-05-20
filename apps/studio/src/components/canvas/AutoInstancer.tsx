import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useEditorStore, SceneObject } from '@/stores/editorStore';

interface InstanceGroup {
  type: SceneObject['type'];
  color: string;
  objects: SceneObject[];
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

/**
 * AutoInstancer - Automatically instances repeated objects for performance
 * 
 * This component analyzes the scene for objects that share:
 * - Same type (box, sphere, cylinder, etc.)
 * - Same color
 * 
 * And renders them using InstancedMesh for massive performance gains
 */
export const AutoInstancer = () => {
  const { objects, isEditMode } = useEditorStore();
  const { instancingEnabled, instancingThreshold } = useEngineSettings();
  const instancedMeshRefs = useRef<Map<string, THREE.InstancedMesh>>(new Map());
  
  // Group objects by type+color
  const instanceGroups = useMemo(() => {
    if (!instancingEnabled || isEditMode) return [];
    
    const groups = new Map<string, InstanceGroup>();
    
    // Only instance primitive types in play mode
    const instanceableTypes: SceneObject['type'][] = ['box', 'sphere', 'cylinder', 'plane'];
    
    objects.forEach(obj => {
      if (!instanceableTypes.includes(obj.type)) return;
      if (!obj.visible) return;
      if (obj.locked && isEditMode) return;
      
      const key = `${obj.type}-${obj.color}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          type: obj.type,
          color: obj.color,
          objects: [],
        });
      }
      
      groups.get(key)!.objects.push(obj);
    });
    
    // Only return groups that meet threshold
    return Array.from(groups.values()).filter(
      group => group.objects.length >= instancingThreshold
    );
  }, [objects, instancingEnabled, instancingThreshold, isEditMode]);
  
  // Get IDs of objects being instanced
  const instancedObjectIds = useMemo(() => {
    const ids = new Set<string>();
    instanceGroups.forEach(group => {
      group.objects.forEach(obj => ids.add(obj.id));
    });
    return ids;
  }, [instanceGroups]);
  
  // Update instance matrices
  useEffect(() => {
    if (isEditMode) return;

    instanceGroups.forEach(group => {
      const key = `${group.type}-${group.color}`;
      const mesh = instancedMeshRefs.current.get(key);
      
      if (!mesh) return;
      
      group.objects.forEach((obj, i) => {
        tempObject.position.set(...obj.position);
        tempObject.rotation.set(
          obj.rotation[0] * Math.PI / 180,
          obj.rotation[1] * Math.PI / 180,
          obj.rotation[2] * Math.PI / 180
        );
        tempObject.scale.set(...obj.scale);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);
      });
      
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [instanceGroups]);
  
  const getGeometry = (type: SceneObject['type']) => {
    switch (type) {
      case 'sphere': return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'plane': return <planeGeometry args={[1, 1]} />;
      case 'box':
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
  };
  
  if (!instancingEnabled || isEditMode || instanceGroups.length === 0) {
    return null;
  }
  
  return (
    <>
      {instanceGroups.map(group => {
        const key = `${group.type}-${group.color}`;
        return (
          <instancedMesh
            key={key}
            ref={(mesh) => {
              if (mesh) instancedMeshRefs.current.set(key, mesh);
            }}
            args={[undefined, undefined, group.objects.length]}
            castShadow
            receiveShadow
          >
            {getGeometry(group.type)}
            <meshStandardMaterial color={group.color} />
          </instancedMesh>
        );
      })}
    </>
  );
};

// Hook to check if an object is being instanced
export const useIsInstanced = (objectId: string) => {
  const { objects } = useEditorStore();
  const { instancingEnabled, instancingThreshold } = useEngineSettings();
  
  return useMemo(() => {
    if (!instancingEnabled) return false;
    
    const obj = objects.find(o => o.id === objectId);
    if (!obj) return false;
    
    const instanceableTypes: SceneObject['type'][] = ['box', 'sphere', 'cylinder', 'plane'];
    if (!instanceableTypes.includes(obj.type)) return false;
    
    // Count objects with same type and color
    const count = objects.filter(
      o => o.type === obj.type && 
           o.color === obj.color && 
           o.visible
    ).length;
    
    return count >= instancingThreshold;
  }, [objectId, objects, instancingEnabled, instancingThreshold]);
};

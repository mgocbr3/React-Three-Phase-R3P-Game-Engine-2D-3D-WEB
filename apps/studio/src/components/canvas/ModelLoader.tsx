import { useRef, useEffect, useState, forwardRef, useImperativeHandle, Suspense } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CuboidCollider, BallCollider, CapsuleCollider } from '@react-three/rapier';
import { RapierRigidBody } from '@react-three/rapier';
import { useAssetStore } from '@/stores/assetStore';

// Preload function for GLTF models (with Draco support built into drei)
export const preloadModel = (url: string) => {
  useGLTF.preload(url);
};

export interface ModelLoaderProps {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  // Physics
  enablePhysics?: boolean;
  bodyType?: 'fixed' | 'dynamic' | 'kinematicPosition';
  colliderType?: 'cuboid' | 'ball' | 'capsule' | 'hull' | 'trimesh';
  mass?: number;
  restitution?: number;
  friction?: number;
  // Animation
  autoPlayAnimation?: boolean;
  animationName?: string;
  animationSpeed?: number;
  loop?: boolean;
  // Events
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
  onLoad?: (gltf: THREE.Group) => void;
}

export interface ModelLoaderRef {
  group: THREE.Group | null;
  rigidBody: RapierRigidBody | null;
  animations: THREE.AnimationClip[];
  actions: Record<string, THREE.AnimationAction>;
  playAnimation: (name: string) => void;
  stopAnimation: (name: string) => void;
  stopAllAnimations: () => void;
}

// Inner component that loads and displays the model
const ModelContent = forwardRef<ModelLoaderRef, ModelLoaderProps>(({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  castShadow = true,
  receiveShadow = true,
  enablePhysics = false,
  bodyType = 'fixed',
  colliderType = 'cuboid',
  mass = 1,
  restitution = 0.2,
  friction = 0.5,
  autoPlayAnimation = false,
  animationName,
  animationSpeed = 1,
  loop = true,
  onClick,
  onPointerOver,
  onPointerOut,
  onLoad,
}, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const [bounds, setBounds] = useState<THREE.Vector3>(new THREE.Vector3(1, 1, 1));
  
  const { addModelToCache, getModelFromCache, setLoadingProgress, removeLoadingProgress } = useAssetStore();
  
  // Load GLTF with Draco support (drei handles it automatically)
  const gltf = useGLTF(url);
  const { actions, clips } = useAnimations(gltf.animations, groupRef);
  
  // Calculate bounds for physics
  useEffect(() => {
    if (gltf.scene) {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      setBounds(size);
      
      // Cache the model
      const cached = getModelFromCache(url);
      if (!cached) {
        addModelToCache({
          id: Math.random().toString(36).substring(2, 9),
          name: url.split('/').pop() || 'model',
          url,
          gltf: gltf as any,
          scene: gltf.scene.clone(),
          animations: gltf.animations,
          loadedAt: Date.now(),
          size: 0, // Would need to track actual size
        });
      }
      
      removeLoadingProgress(url);
      onLoad?.(gltf.scene);
    }
  }, [gltf.scene, url]);
  
  // Setup shadows
  useEffect(() => {
    if (gltf.scene) {
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = castShadow;
          child.receiveShadow = receiveShadow;
        }
      });
    }
  }, [gltf.scene, castShadow, receiveShadow]);
  
  // Animation handling
  useEffect(() => {
    if (autoPlayAnimation && clips.length > 0) {
      const targetAnim = animationName || clips[0].name;
      const action = actions[targetAnim];
      if (action) {
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = !loop;
        action.timeScale = animationSpeed;
        action.play();
      }
    }
    
    return () => {
      Object.values(actions).forEach(action => action?.stop());
    };
  }, [autoPlayAnimation, animationName, animationSpeed, loop, actions, clips]);
  
  // Expose ref methods
  useImperativeHandle(ref, () => ({
    group: groupRef.current,
    rigidBody: rigidBodyRef.current,
    animations: clips,
    actions: actions as Record<string, THREE.AnimationAction>,
    playAnimation: (name: string) => {
      const action = actions[name];
      if (action) {
        action.reset().play();
      }
    },
    stopAnimation: (name: string) => {
      const action = actions[name];
      if (action) {
        action.stop();
      }
    },
    stopAllAnimations: () => {
      Object.values(actions).forEach(action => action?.stop());
    },
  }), [actions, clips]);
  
  const scaleArray = typeof scale === 'number' ? [scale, scale, scale] : scale;
  
  const renderCollider = () => {
    const scaledBounds = bounds.clone().multiply(
      new THREE.Vector3(...(scaleArray as [number, number, number]))
    );
    
    switch (colliderType) {
      case 'ball':
        return <BallCollider args={[Math.max(scaledBounds.x, scaledBounds.y, scaledBounds.z) / 2]} />;
      case 'capsule':
        return <CapsuleCollider args={[scaledBounds.y / 4, Math.max(scaledBounds.x, scaledBounds.z) / 2]} />;
      case 'cuboid':
      default:
        return <CuboidCollider args={[scaledBounds.x / 2, scaledBounds.y / 2, scaledBounds.z / 2]} />;
    }
  };
  
  const modelElement = (
    <group
      ref={groupRef}
      position={enablePhysics ? [0, 0, 0] : position}
      rotation={rotation.map(r => r * Math.PI / 180) as [number, number, number]}
      scale={scaleArray as [number, number, number]}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <primitive object={gltf.scene.clone()} />
    </group>
  );
  
  if (enablePhysics) {
    return (
      <RigidBody
        ref={rigidBodyRef}
        type={bodyType}
        position={position}
        mass={mass}
        restitution={restitution}
        friction={friction}
      >
        {modelElement}
        {renderCollider()}
      </RigidBody>
    );
  }
  
  return modelElement;
});

ModelContent.displayName = 'ModelContent';

// Loading fallback component
const ModelFallback = ({ url }: { url: string }) => {
  const { setLoadingProgress } = useAssetStore();
  
  useEffect(() => {
    setLoadingProgress(url, url.split('/').pop() || 'model', 50, 'loading');
  }, [url]);
  
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#a855f7" wireframe opacity={0.5} transparent />
    </mesh>
  );
};

// Main exported component with Suspense wrapper
export const ModelLoader = forwardRef<ModelLoaderRef, ModelLoaderProps>((props, ref) => {
  return (
    <Suspense fallback={<ModelFallback url={props.url} />}>
      <ModelContent {...props} ref={ref} />
    </Suspense>
  );
});

ModelLoader.displayName = 'ModelLoader';

// Hook for loading models imperatively
export const useModelLoader = (url: string) => {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getModelFromCache } = useAssetStore();
  
  useEffect(() => {
    const cached = getModelFromCache(url);
    if (cached) {
      setModel(cached.scene.clone());
      setLoading(false);
      return;
    }
    
    // Load using useGLTF preload
    try {
      useGLTF.preload(url);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load model');
      setLoading(false);
    }
  }, [url]);
  
  return { model, loading, error };
};

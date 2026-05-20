import { useRef, useEffect, forwardRef, useImperativeHandle, Suspense, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { RapierRigidBody } from '@react-three/rapier';
import { AnimationSettings } from '@/stores/editorStore';

export interface AnimationControllerProps {
  modelUrl: string;
  animationSettings: AnimationSettings;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  // Physics
  enablePhysics?: boolean;
  bodyType?: 'fixed' | 'dynamic' | 'kinematicPosition';
  // Callbacks
  onAnimationsLoaded?: (animations: string[]) => void;
  onClick?: () => void;
}

export interface AnimationControllerRef {
  group: THREE.Group | null;
  rigidBody: RapierRigidBody | null;
  playAnimation: (name: string) => void;
  pauseAnimation: () => void;
  resumeAnimation: () => void;
  setSpeed: (speed: number) => void;
  getAnimationNames: () => string[];
}

const AnimationControllerContent = forwardRef<AnimationControllerRef, AnimationControllerProps>(({
  modelUrl,
  animationSettings,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  castShadow = true,
  receiveShadow = true,
  enablePhysics = false,
  bodyType = 'fixed',
  onAnimationsLoaded,
  onClick,
}, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const [bounds, setBounds] = useState<THREE.Vector3>(new THREE.Vector3(1, 1, 1));
  const prevAnimationRef = useRef<string | null>(null);
  
  // Load GLTF
  const gltf = useGLTF(modelUrl);
  const { actions, clips = [], mixer } = useAnimations(gltf.animations || [], groupRef);
  
  // Calculate bounds for physics
  useEffect(() => {
    if (gltf.scene) {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      setBounds(size);
      
      // Notify parent of available animations
      const animNames = (clips || []).map(c => c.name);
      onAnimationsLoaded?.(animNames);
    }
  }, [gltf.scene, clips, onAnimationsLoaded]);
  
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
  
  // Handle animation changes
  useEffect(() => {
    if (!animationSettings.currentAnimation || !actions[animationSettings.currentAnimation]) {
      // Play first animation if none selected
      if ((clips || []).length > 0 && animationSettings.autoPlay) {
        const firstAnim = clips[0].name;
        const action = actions[firstAnim];
        if (action) {
          action.setLoop(animationSettings.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
          action.clampWhenFinished = !animationSettings.loop;
          action.play();
          prevAnimationRef.current = firstAnim;
        }
      }
      return;
    }
    
    const targetAnimation = animationSettings.currentAnimation;
    const action = actions[targetAnimation];
    
    if (!action) return;
    
    // Crossfade from previous animation
    if (prevAnimationRef.current && prevAnimationRef.current !== targetAnimation) {
      const prevAction = actions[prevAnimationRef.current];
      if (prevAction) {
        action.reset();
        action.crossFadeFrom(prevAction, animationSettings.crossFadeDuration, true);
      }
    }
    
    action.setLoop(animationSettings.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !animationSettings.loop;
    action.play();
    prevAnimationRef.current = targetAnimation;
  }, [animationSettings.currentAnimation, animationSettings.loop, animationSettings.crossFadeDuration, actions, clips, animationSettings.autoPlay]);
  
  // Handle pause/resume
  useEffect(() => {
    if (animationSettings.currentAnimation) {
      const action = actions[animationSettings.currentAnimation];
      if (action) {
        action.paused = animationSettings.paused;
      }
    }
  }, [animationSettings.paused, animationSettings.currentAnimation, actions]);
  
  // Handle speed changes
  useEffect(() => {
    if (animationSettings.currentAnimation) {
      const action = actions[animationSettings.currentAnimation];
      if (action) {
        action.timeScale = animationSettings.speed;
      }
    }
  }, [animationSettings.speed, animationSettings.currentAnimation, actions]);
  
  // Expose ref methods
  useImperativeHandle(ref, () => ({
    group: groupRef.current,
    rigidBody: rigidBodyRef.current,
    playAnimation: (name: string) => {
      const action = actions[name];
      if (action) {
        action.reset().play();
      }
    },
    pauseAnimation: () => {
      Object.values(actions).forEach(action => {
        if (action) action.paused = true;
      });
    },
    resumeAnimation: () => {
      Object.values(actions).forEach(action => {
        if (action) action.paused = false;
      });
    },
    setSpeed: (speed: number) => {
      Object.values(actions).forEach(action => {
        if (action) action.timeScale = speed;
      });
    },
    getAnimationNames: () => (clips || []).map(c => c.name),
  }), [actions, clips]);
  
  const scaleArray = typeof scale === 'number' ? [scale, scale, scale] : scale;
  
  const modelElement = (
    <group
      ref={groupRef}
      position={enablePhysics ? [0, 0, 0] : position}
      rotation={rotation.map(r => r * Math.PI / 180) as [number, number, number]}
      scale={scaleArray as [number, number, number]}
      onClick={onClick}
    >
      <primitive object={gltf.scene.clone()} />
    </group>
  );
  
  if (enablePhysics) {
    const scaledBounds = bounds.clone().multiply(
      new THREE.Vector3(...(scaleArray as [number, number, number]))
    );
    
    return (
      <RigidBody
        ref={rigidBodyRef}
        type={bodyType}
        position={position}
      >
        {modelElement}
        <CuboidCollider args={[scaledBounds.x / 2, scaledBounds.y / 2, scaledBounds.z / 2]} />
      </RigidBody>
    );
  }
  
  return modelElement;
});

AnimationControllerContent.displayName = 'AnimationControllerContent';

// Loading fallback
const AnimationControllerFallback = () => (
  <mesh>
    <capsuleGeometry args={[0.5, 1, 8, 16]} />
    <meshStandardMaterial color="#f97316" wireframe opacity={0.5} transparent />
  </mesh>
);

// Main component with Suspense
export const AnimationController = forwardRef<AnimationControllerRef, AnimationControllerProps>((props, ref) => (
  <Suspense fallback={<AnimationControllerFallback />}>
    <AnimationControllerContent {...props} ref={ref} />
  </Suspense>
));

AnimationController.displayName = 'AnimationController';

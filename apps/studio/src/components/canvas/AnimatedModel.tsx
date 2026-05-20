import { useRef, useEffect, useState, forwardRef, useImperativeHandle, Suspense } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface AnimationState {
  name: string;
  duration: number;
  isPlaying: boolean;
  time: number;
  weight: number;
}

export interface AnimatedModelProps {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  // Animation config
  defaultAnimation?: string;
  autoPlay?: boolean;
  crossFadeDuration?: number;
  // Events
  onAnimationComplete?: (name: string) => void;
  onLoad?: (animations: string[]) => void;
}

export interface AnimatedModelRef {
  group: THREE.Group | null;
  // Animation control
  playAnimation: (name: string, options?: {
    loop?: boolean;
    clampWhenFinished?: boolean;
    timeScale?: number;
    crossFade?: boolean;
    crossFadeDuration?: number;
  }) => void;
  stopAnimation: (name: string) => void;
  stopAllAnimations: () => void;
  pauseAnimation: (name: string) => void;
  resumeAnimation: (name: string) => void;
  setAnimationTime: (name: string, time: number) => void;
  setAnimationWeight: (name: string, weight: number) => void;
  crossFadeTo: (from: string, to: string, duration?: number) => void;
  // State
  getAnimationNames: () => string[];
  getAnimationState: (name: string) => AnimationState | null;
  getCurrentAnimation: () => string | null;
}

const AnimatedModelContent = forwardRef<AnimatedModelRef, AnimatedModelProps>(({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  castShadow = true,
  receiveShadow = true,
  defaultAnimation,
  autoPlay = true,
  crossFadeDuration = 0.5,
  onAnimationComplete,
  onLoad,
}, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  
  const gltf = useGLTF(url);
  const { actions, clips, mixer } = useAnimations(gltf.animations, groupRef);
  
  // Setup shadows
  useEffect(() => {
    if (gltf.scene) {
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = castShadow;
          child.receiveShadow = receiveShadow;
        }
      });
      
      // Notify parent of available animations
      const animNames = clips.map(c => c.name);
      onLoad?.(animNames);
    }
  }, [gltf.scene, castShadow, receiveShadow, clips]);
  
  // Auto-play default animation
  useEffect(() => {
    if (autoPlay && clips.length > 0) {
      const targetAnim = defaultAnimation || clips[0].name;
      const action = actions[targetAnim];
      if (action) {
        action.play();
        setCurrentAnimation(targetAnim);
      }
    }
  }, [autoPlay, defaultAnimation, actions, clips]);
  
  // Listen for animation finished events
  useEffect(() => {
    if (mixer) {
      const handleFinished = (e: THREE.Event & { action: THREE.AnimationAction }) => {
        const clip = e.action.getClip();
        onAnimationComplete?.(clip.name);
      };
      
      mixer.addEventListener('finished', handleFinished as any);
      return () => {
        mixer.removeEventListener('finished', handleFinished as any);
      };
    }
  }, [mixer, onAnimationComplete]);
  
  // Expose ref methods
  useImperativeHandle(ref, () => ({
    group: groupRef.current,
    
    playAnimation: (name, options = {}) => {
      const action = actions[name];
      if (!action) return;
      
      const {
        loop = true,
        clampWhenFinished = false,
        timeScale = 1,
        crossFade = true,
        crossFadeDuration: fadeDuration = crossFadeDuration,
      } = options;
      
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = clampWhenFinished;
      action.timeScale = timeScale;
      
      if (crossFade && currentAnimation && currentAnimation !== name) {
        const currentAction = actions[currentAnimation];
        if (currentAction) {
          action.reset();
          action.crossFadeFrom(currentAction, fadeDuration, true);
        }
      }
      
      action.play();
      setCurrentAnimation(name);
    },
    
    stopAnimation: (name) => {
      const action = actions[name];
      if (action) {
        action.stop();
        if (currentAnimation === name) {
          setCurrentAnimation(null);
        }
      }
    },
    
    stopAllAnimations: () => {
      Object.values(actions).forEach(action => action?.stop());
      setCurrentAnimation(null);
    },
    
    pauseAnimation: (name) => {
      const action = actions[name];
      if (action) {
        action.paused = true;
      }
    },
    
    resumeAnimation: (name) => {
      const action = actions[name];
      if (action) {
        action.paused = false;
      }
    },
    
    setAnimationTime: (name, time) => {
      const action = actions[name];
      if (action) {
        action.time = time;
      }
    },
    
    setAnimationWeight: (name, weight) => {
      const action = actions[name];
      if (action) {
        action.setEffectiveWeight(weight);
      }
    },
    
    crossFadeTo: (from, to, duration = crossFadeDuration) => {
      const fromAction = actions[from];
      const toAction = actions[to];
      
      if (fromAction && toAction) {
        toAction.reset();
        toAction.crossFadeFrom(fromAction, duration, true);
        toAction.play();
        setCurrentAnimation(to);
      }
    },
    
    getAnimationNames: () => clips.map(c => c.name),
    
    getAnimationState: (name) => {
      const action = actions[name];
      const clip = clips.find(c => c.name === name);
      
      if (!action || !clip) return null;
      
      return {
        name,
        duration: clip.duration,
        isPlaying: action.isRunning(),
        time: action.time,
        weight: action.getEffectiveWeight(),
      };
    },
    
    getCurrentAnimation: () => currentAnimation,
  }), [actions, clips, currentAnimation, crossFadeDuration]);
  
  const scaleArray = typeof scale === 'number' ? [scale, scale, scale] : scale;
  
  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation.map(r => r * Math.PI / 180) as [number, number, number]}
      scale={scaleArray as [number, number, number]}
    >
      <primitive object={gltf.scene.clone()} />
    </group>
  );
});

AnimatedModelContent.displayName = 'AnimatedModelContent';

// Loading fallback
const AnimatedModelFallback = () => (
  <mesh>
    <capsuleGeometry args={[0.5, 1, 8, 16]} />
    <meshStandardMaterial color="#a855f7" wireframe opacity={0.5} transparent />
  </mesh>
);

// Main component with Suspense
export const AnimatedModel = forwardRef<AnimatedModelRef, AnimatedModelProps>((props, ref) => (
  <Suspense fallback={<AnimatedModelFallback />}>
    <AnimatedModelContent {...props} ref={ref} />
  </Suspense>
));

AnimatedModel.displayName = 'AnimatedModel';

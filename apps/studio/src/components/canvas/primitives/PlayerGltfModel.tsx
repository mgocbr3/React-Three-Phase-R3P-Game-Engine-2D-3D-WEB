import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneGltfScene } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Loads + clones a GLTF asset to render as the player visual. Default
 * player model lives at `/models/manequin/scene.gltf` (CC-BY-4.0); see
 * `docs/THIRD-PARTY-ASSETS.md`.
 *
 * - Clones the cached scene so multiple players don't share the same
 *   skeleton/pose.
 * - Auto-scales so the bounding-box height fits ~1.8 world units —
 *   keeps the model the same effective size whether the source GLTF
 *   ships in cm, mm or m, and matches the legacy Minecraft character
 *   so existing camera offsets and capsule colliders still feel right.
 * - Drops the model on `y=0` (subtracts bbox.min.y) so feet land on
 *   the ground regardless of how the GLTF baked its origin.
 */
export const PlayerGltfModel = ({
  url,
  targetHeight = 1.8,
  animationName = 'Idle',
  animationSpeed = 1,
}: {
  url: string;
  targetHeight?: number;
  animationName?: string;
  animationSpeed?: number;
}) => {
  const { scene, animations } = useGLTF(url);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const cloned = useMemo(() => {
    const clone = cloneGltfScene(scene);
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    if (size.y > 0.0001) {
      const scale = targetHeight / size.y;
      clone.scale.setScalar(scale);
      const scaledBox = new THREE.Box3().setFromObject(clone);
      clone.position.y -= scaledBox.min.y;
    }
    return clone;
  }, [scene, targetHeight]);

  useEffect(() => {
    mixerRef.current?.stopAllAction();
    actionRef.current = null;
    mixerRef.current = animations.length ? new THREE.AnimationMixer(cloned) : null;
    return () => {
      mixerRef.current?.stopAllAction();
    };
  }, [animations.length, cloned]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || !animations.length) return;
    const wanted = animationName.toLowerCase();
    const clip = animations.find((item) => item.name.toLowerCase() === wanted)
      ?? animations.find((item) => item.name.toLowerCase().includes(wanted))
      ?? animations.find((item) => item.name.toLowerCase().includes('idle'))
      ?? animations[0];
    const next = mixer.clipAction(clip);
    if (actionRef.current && actionRef.current !== next) actionRef.current.fadeOut(0.15);
    next.reset().setEffectiveTimeScale(animationSpeed).fadeIn(0.15).play();
    actionRef.current = next;
  }, [animations, animationName, animationSpeed]);

  useFrame((_, delta) => mixerRef.current?.update(delta));

  return <primitive object={cloned} />;
};

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

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
}: {
  url: string;
  targetHeight?: number;
}) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
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

  return <primitive object={cloned} />;
};

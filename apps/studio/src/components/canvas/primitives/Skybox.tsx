// Skybox renderer.
//
// Extracts the color texture from the UE4 sky GLB and runs it through
// PMREMGenerator to produce a proper cubemap render target, then binds
// the cubemap as scene.background. PMREM handles any source aspect
// ratio cleanly — the UE4 texture is 1024×1024 (not the 2:1 equirect
// Three.js's direct equirect sampling path assumes), so binding the
// raw texture as background gave solid bands. PMREM bakes it into a
// cubemap with 6 native faces; sampling works in any direction.
//
// `flipY = false` matches the artist's intent: V=0 in the source
// image is the top of the sky (white clouds) and V=1 is the bottom
// (horizon haze). With flipY=true the GLTF loader's default flips
// the source, which puts clouds on the ground.
//
// Default model: Unreal Engine 4 Sky (CC-BY-4.0) baked into
// `public/models/skybox/`. See `docs/THIRD-PARTY-ASSETS.md`.

import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SkyboxProps {
  url?: string;
}

export const Skybox = ({
  url = '/models/skybox/ue4-sky.glb',
}: SkyboxProps) => {
  const { scene } = useGLTF(url);
  const { scene: r3fScene, gl } = useThree();

  useEffect(() => {
    let sourceTexture: THREE.Texture | null = null;
    scene.traverse((obj) => {
      if (sourceTexture) return;
      if (obj instanceof THREE.Mesh && obj.material) {
        const m = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as
          THREE.MeshStandardMaterial & { map?: THREE.Texture | null };
        if (m.map) sourceTexture = m.map;
      }
    });
    if (!sourceTexture) return;

    const tex = sourceTexture as THREE.Texture;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromEquirectangular(tex);

    const previousBackground = r3fScene.background;
    r3fScene.background = target.texture;

    return () => {
      r3fScene.background = previousBackground;
      target.dispose();
      pmrem.dispose();
    };
  }, [scene, r3fScene, gl]);

  return null;
};

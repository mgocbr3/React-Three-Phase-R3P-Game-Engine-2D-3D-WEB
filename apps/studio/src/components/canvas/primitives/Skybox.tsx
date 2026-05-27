// Skybox renderer.
//
// Loads the UE4 sky GLB (CC-BY-4.0, see docs/THIRD-PARTY-ASSETS.md),
// extracts its color texture, and runs it through PMREMGenerator to
// produce a proper cubemap render target. Three.js's scene.background
// can then sample the cubemap correctly regardless of the source
// texture aspect ratio — sidesteps the 2:1-equirect assumption that
// broke when we tried to bind the 1024×1024 source directly.
//
// PMREM is built for IBL environment maps but works perfectly fine as
// a skybox source — drei's `<Environment>` uses the same pipeline for
// HDR files.

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
    // Pull the texture out of the GLB's first textured mesh.
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

    // Run PMREM to bake the equirect texture into a cubemap render
    // target. This is the same path drei's <Environment> uses for HDRs
    // and is the most robust way to display a non-2:1 source as a sky.
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

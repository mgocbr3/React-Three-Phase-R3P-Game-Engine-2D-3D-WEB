// Skybox renderer.
//
// Pulls the texture out of the UE4 sky GLB and binds it directly as
// `scene.background` with equirectangular mapping. This uses Three.js's
// own built-in skybox path — the renderer paints the texture as a
// fullscreen background before drawing any geometry, no Z-buffer
// shenanigans, no inverted-sphere mesh, no follow-camera logic.
//
// The GLB ships an inverted-sphere skydome with a single 1024×1024
// equirect-style texture inside. We don't render the dome mesh at all
// — we just steal its texture. Cleaner, faster, and survives the
// EditorCanvas's R3F + tonemapping setup that the mesh approach
// kept fighting with.
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
  const { scene: r3fScene } = useThree();

  useEffect(() => {
    // Walk the loaded GLB and grab the first textured mesh's color
    // map. We only need the texture — the geometry is irrelevant
    // because we render via scene.background.
    let texture: THREE.Texture | null = null;
    scene.traverse((obj) => {
      if (texture) return;
      if (obj instanceof THREE.Mesh && obj.material) {
        const m = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as
          THREE.MeshStandardMaterial & { map?: THREE.Texture | null };
        if (m.map) texture = m.map;
      }
    });

    if (!texture) return;

    // The texture was authored as a UV wrap for an inverted skydome:
    // it expects the renderer to be INSIDE the sphere looking outward.
    // Three.js scene.background with EquirectangularReflectionMapping
    // assumes the camera is at the center of an outward-facing sphere
    // — same geometry, so we can reuse the path BUT the UV convention
    // is different for skydome textures: the "top of the image" winds
    // up at the bottom of the viewport unless we flip Y.
    //
    // - `flipY = false` lifts the default GLTF flip so the source
    //   image's row 0 maps to the top of the sky (white clouds) and
    //   the bottom of the image maps to the horizon/ground.
    // - `colorSpace = SRGBColorSpace` keeps the authored colors looking
    //   correct against our renderer's outputColorSpace = "srgb".
    const tex = texture as THREE.Texture;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.needsUpdate = true;

    const previousBackground = r3fScene.background;
    r3fScene.background = tex;

    return () => {
      // Restore whatever the scene had before (typically null or a
      // <color attach="background"> value the editor wants back).
      r3fScene.background = previousBackground;
    };
  }, [scene, r3fScene]);

  return null;
};

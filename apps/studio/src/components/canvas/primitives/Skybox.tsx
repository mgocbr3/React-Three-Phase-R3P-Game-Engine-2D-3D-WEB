// Skybox renderer.
//
// Loads the downloaded pure-sky equirectangular skybox used as the base R3P sky.
// IBL remains owned by `<Environment>` in `AtmosphericLighting.tsx`; this only
// controls the visible scene background.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

interface SkyboxProps {
  url?: string;
}

export const Skybox = ({
  url = '/skybox/kloppenheim_05_puresky_4k.jpg',
}: SkyboxProps) => {
  const texture = useTexture(url);
  const { scene } = useThree();

  const skyTexture = useMemo(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [texture]);

  useEffect(() => {
    const previousBackground = scene.background;
    scene.background = skyTexture;
    return () => {
      scene.background = previousBackground;
    };
  }, [skyTexture, scene]);

  return null;
};

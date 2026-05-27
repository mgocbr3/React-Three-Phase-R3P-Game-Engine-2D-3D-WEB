// Skybox renderer.
//
// Loads a CC0 HDR (Radiance) skybox via drei's `useEnvironment` hook,
// which handles RGBELoader + PMREM baking automatically. The result is
// a pre-filtered cubemap-like environment texture that gets bound as
// `scene.background`.
//
// We pivoted to HDR because the original UE4 sky GLB was authored at
// 1024x1024 (not the 2:1 equirect aspect Three.js expects) and bled
// the clouds onto the floor regardless of how we set `flipY` /
// `backgroundRotation` / PMREM. Standard 2:1 equirect HDRs from
// Polyhaven (HDRI Haven) ship with the canonical UV layout where V=0
// is the bottom (ground) and V=1 is the top (zenith) — Three.js
// samples them correctly out of the box.
//
// IBL (image-based lighting) is still owned by the `<Environment
// preset>` in `AtmosphericLighting.tsx` so the time-of-day variations
// (night/sunset/morning/day) keep working. This component touches only
// `scene.background`.
//
// Default model: Polyhaven "Kloofendal 43d Clear (Pure Sky)" CC0,
// stored at `public/models/skybox/clear-sky.hdr`. See
// `docs/THIRD-PARTY-ASSETS.md`.

import { useEffect } from 'react';
import { useEnvironment } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

interface SkyboxProps {
  url?: string;
}

export const Skybox = ({
  url = '/models/skybox/clear-sky.hdr',
}: SkyboxProps) => {
  const texture = useEnvironment({ files: url });
  const { scene } = useThree();

  useEffect(() => {
    const previousBackground = scene.background;
    scene.background = texture;
    return () => {
      scene.background = previousBackground;
    };
  }, [texture, scene]);

  return null;
};

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useEditorStore } from '@/stores/editorStore';

const createSunTexture = (): THREE.Texture | null => {
  if (typeof document === 'undefined') return null;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.18, 'rgba(255, 250, 214, 1)');
  gradient.addColorStop(0.38, 'rgba(255, 209, 115, 0.72)');
  gradient.addColorStop(0.72, 'rgba(255, 176, 66, 0.16)');
  gradient.addColorStop(1, 'rgba(255, 176, 66, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const getCameraVisibleSkyPosition = (
  camera: THREE.Camera,
  direction: THREE.Vector3,
  distance: number,
): THREE.Vector3 => {
  const target = camera.position.clone().addScaledVector(direction, distance);
  const projected = target.clone().project(camera);
  const isProjectedVisible = (
    Number.isFinite(projected.x) &&
    Number.isFinite(projected.y) &&
    Number.isFinite(projected.z) &&
    projected.z >= -1 &&
    projected.z <= 1 &&
    Math.abs(projected.x) <= 0.82 &&
    Math.abs(projected.y) <= 0.78
  );

  if (isProjectedVisible) return target;

  const localDirection = direction.clone().applyQuaternion(camera.quaternion.clone().invert());
  const x = Number.isFinite(projected.x)
    ? clamp(projected.x, -0.72, 0.72)
    : clamp(localDirection.x * 1.4, -0.72, 0.72);
  const y = Number.isFinite(projected.y)
    ? clamp(projected.y, -0.24, 0.72)
    : clamp(localDirection.y * 1.2, -0.12, 0.72);
  const fallback = new THREE.Vector3(x, y, 0.5).unproject(camera);
  return camera.position.clone().addScaledVector(
    fallback.sub(camera.position).normalize(),
    distance,
  );
};

export const SunDisk = () => {
  const sunLight = useEditorStore((state) => (
    state.objects.find((object) => object.type === 'sunlight' && object.visible !== false)
  ));
  const spriteRef = useRef<THREE.Sprite>(null);
  const texture = useMemo(createSunTexture, []);
  const { camera } = useThree();
  const lightSettings = sunLight?.lightSettings;
  const direction = useMemo(() => {
    const elevation = ((lightSettings?.sunElevation ?? 45) * Math.PI) / 180;
    const azimuth = ((lightSettings?.sunAzimuth ?? 180) * Math.PI) / 180;
    return new THREE.Vector3(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(azimuth) * Math.cos(elevation),
    ).normalize();
  }, [lightSettings?.sunAzimuth, lightSettings?.sunElevation]);
  const baseSize = Math.max(8, Math.min(180, (lightSettings?.intensity ?? 1) * 34));

  useEffect(() => () => {
    texture?.dispose();
  }, [texture]);

  useFrame(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const cameraFar = (camera as THREE.Camera & { far?: number }).far;
    const maxDistance = typeof cameraFar === 'number' && Number.isFinite(cameraFar)
      ? Math.max(10, cameraFar * 0.72)
      : 760;
    const distance = Math.min(760, maxDistance);
    sprite.position.copy(getCameraVisibleSkyPosition(camera, direction, distance));
    const size = baseSize * (distance / 760);
    sprite.scale.set(size, size, 1);
  });

  if (!sunLight || lightSettings?.intensity === 0) return null;

  return (
    <sprite
      ref={spriteRef}
      name="Pixl Sky Sun"
      frustumCulled={false}
      renderOrder={-900}
      userData={{ pixlSkySun: true }}
      raycast={() => undefined}
    >
      <spriteMaterial
        {...(texture ? { map: texture } : {})}
        color={sunLight.color || '#fff7cf'}
        opacity={Math.min(1, Math.max(0.35, lightSettings?.intensity ?? 1))}
        transparent
        depthWrite={false}
        depthTest={false}
        fog={false}
      />
    </sprite>
  );
};

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CameraSettings } from '@/stores/editorStore';

interface GameCameraProps {
  settings: CameraSettings;
  targetRef: React.RefObject<THREE.Object3D>;
}

export const GameCamera = ({ settings, targetRef }: GameCameraProps) => {
  const { camera } = useThree();
  const cameraTarget = useRef(new THREE.Vector3());
  const currentPosition = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  const lastMode = useRef<string | null>(null);

  // Reset camera state when mode changes
  useEffect(() => {
    if (lastMode.current !== null && lastMode.current !== settings.mode) {
      initialized.current = false;
    }
    lastMode.current = settings.mode;
  }, [settings.mode]);

  // Set initial camera FOV
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = settings.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, settings.fov]);

  useFrame(() => {
    // If no target or followPlayer is disabled and not first-person, don't follow
    if (!targetRef.current) {
      // If no target, set to fixed position
      if (!initialized.current) {
        camera.position.set(0, settings.height, settings.distance);
        camera.lookAt(0, 0, 0);
        initialized.current = true;
      }
      return;
    }

    // If followPlayer is disabled and not first-person mode, don't move camera
    if (!settings.followPlayer && settings.mode !== 'first-person') {
      if (!initialized.current) {
        camera.position.set(0, settings.height, settings.distance);
        camera.lookAt(0, 0, 0);
        initialized.current = true;
      }
      return;
    }

    const target = targetRef.current;
    const pos = target.position;

    // Calculate desired camera position based on mode
    let desiredPosition = new THREE.Vector3();
    let lookAtTarget = new THREE.Vector3(pos.x, pos.y + 1, pos.z);

    switch (settings.mode) {
      case 'first-person':
        // Camera at player head height
        desiredPosition.set(pos.x, pos.y + settings.height, pos.z);
        lookAtTarget.set(pos.x, pos.y + settings.height, pos.z - 5);
        break;

      case 'side-2d':
        // Camera fixed on Z axis, follows X and Y
        desiredPosition.set(pos.x, pos.y + settings.height, settings.distance);
        lookAtTarget.set(pos.x, pos.y + 1, 0);
        break;

      case 'top-down':
        // Camera above player
        desiredPosition.set(pos.x, settings.height, pos.z + 0.01);
        lookAtTarget.set(pos.x, pos.y, pos.z);
        break;

      case 'fixed':
        // Camera doesn't move
        if (!initialized.current) {
          camera.position.set(0, settings.height, settings.distance);
          camera.lookAt(0, 0, 0);
          initialized.current = true;
        }
        return;

      case 'third-person':
      default:
        // Camera behind and above player
        desiredPosition.set(
          pos.x,
          pos.y + settings.height,
          pos.z + settings.distance
        );
        lookAtTarget.set(pos.x, pos.y + 1, pos.z);
        break;
    }

    // Apply locked axes
    if (settings.lockedZ && settings.mode !== 'side-2d') {
      desiredPosition.z = settings.distance;
    }
    if (settings.lockedY && settings.mode !== 'top-down') {
      desiredPosition.y = settings.height;
    }

    // Initialize on first frame
    if (!initialized.current) {
      currentPosition.current.copy(desiredPosition);
      initialized.current = true;
    }

    // Smooth follow
    currentPosition.current.lerp(desiredPosition, settings.smoothing);

    camera.position.copy(currentPosition.current);
    
    // Smooth look at
    cameraTarget.current.lerp(lookAtTarget, settings.smoothing * 2);
    camera.lookAt(cameraTarget.current);
  });

  return null;
};

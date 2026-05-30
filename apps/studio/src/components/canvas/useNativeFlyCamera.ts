import { useEffect, useRef } from 'react';

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface UseNativeFlyCameraArgs {
  canvas: HTMLCanvasElement | null;
  camera: THREE.PerspectiveCamera | null;
  orbitControls?: OrbitControls | null;
  enabled?: boolean;
  speed?: number;
  fastMultiplier?: number;
  lookSpeed?: number;
  onChange?: () => void;
}

type FlyKey = 'w' | 'a' | 's' | 'd' | 'q' | 'e';

const FLY_KEYS = new Set<FlyKey>(['w', 'a', 's', 'd', 'q', 'e']);
const MIN_FLY_SPEED = 1;
const MAX_FLY_SPEED = 200;

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') return true;
  return element.isContentEditable;
};

const clampFlySpeed = (speed: number): number => Math.max(MIN_FLY_SPEED, Math.min(MAX_FLY_SPEED, speed));

export const useNativeFlyCamera = ({
  canvas,
  camera,
  orbitControls,
  enabled = true,
  speed = 12,
  fastMultiplier = 2.5,
  lookSpeed = 0.003,
  onChange,
}: UseNativeFlyCameraArgs): void => {
  const speedRef = useRef(clampFlySpeed(speed));
  const keysRef = useRef<Record<FlyKey, boolean>>({ w: false, a: false, s: false, d: false, q: false, e: false });
  const shiftRef = useRef(false);
  const flyingRef = useRef(false);
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const lastFrameRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    speedRef.current = clampFlySpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (!canvas || !camera || !enabled) return;

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const movement = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);

    const stopFrameLoop = (): void => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      lastFrameRef.current = 0;
    };

    const syncOrbitTarget = (): void => {
      if (!orbitControls) return;
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const currentDistance = Math.max(1, camera.position.distanceTo(orbitControls.target));
      orbitControls.target.copy(camera.position).addScaledVector(forward, currentDistance);
      orbitControls.update();
    };

    const tick = (timestamp: number): void => {
      frameRef.current = window.requestAnimationFrame(tick);
      if (!flyingRef.current) return;
      const previous = lastFrameRef.current || timestamp;
      const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previous) / 1000));
      lastFrameRef.current = timestamp;

      movement.set(0, 0, 0);
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);

      if (keysRef.current.w) movement.add(forward);
      if (keysRef.current.s) movement.sub(forward);
      if (keysRef.current.d) movement.add(right);
      if (keysRef.current.a) movement.sub(right);
      if (keysRef.current.e) movement.add(worldUp);
      if (keysRef.current.q) movement.sub(worldUp);

      if (movement.lengthSq() === 0) return;
      movement.normalize().multiplyScalar(speedRef.current * (shiftRef.current ? fastMultiplier : 1) * deltaSeconds);
      camera.position.add(movement);
      syncOrbitTarget();
      onChange?.();
    };

    const startFlying = (): void => {
      if (flyingRef.current) return;
      flyingRef.current = true;
      eulerRef.current.setFromQuaternion(camera.quaternion);
      if (orbitControls) orbitControls.enabled = false;
      canvas.style.cursor = 'grabbing';
      window.dispatchEvent(new CustomEvent('camera-speed-change', {
        detail: { speed: speedRef.current, minSpeed: MIN_FLY_SPEED, maxSpeed: MAX_FLY_SPEED },
      }));
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(tick);
    };

    const stopFlying = (): void => {
      if (!flyingRef.current) return;
      flyingRef.current = false;
      if (orbitControls) orbitControls.enabled = true;
      canvas.style.cursor = 'auto';
      Object.keys(keysRef.current).forEach((key) => {
        keysRef.current[key as FlyKey] = false;
      });
      shiftRef.current = false;
      syncOrbitTarget();
      onChange?.();
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 2) return;
      event.preventDefault();
      event.stopPropagation();
      startFlying();
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.button !== 2) return;
      event.preventDefault();
      stopFlying();
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (!flyingRef.current) return;
      event.preventDefault();
      eulerRef.current.y -= event.movementX * lookSpeed;
      eulerRef.current.x -= event.movementY * lookSpeed;
      eulerRef.current.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, eulerRef.current.x));
      camera.quaternion.setFromEuler(eulerRef.current);
      syncOrbitTarget();
      onChange?.();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase() as FlyKey;
      if (FLY_KEYS.has(key)) {
        keysRef.current[key] = true;
        if (flyingRef.current) event.preventDefault();
      }
      if (event.shiftKey) shiftRef.current = true;
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase() as FlyKey;
      if (FLY_KEYS.has(key)) keysRef.current[key] = false;
      if (!event.shiftKey) shiftRef.current = false;
    };

    const handleWheel = (event: WheelEvent): void => {
      if (!flyingRef.current) return;
      event.preventDefault();
      const step = event.deltaY > 0 ? -2 : 2;
      speedRef.current = clampFlySpeed(speedRef.current + step);
      window.dispatchEvent(new CustomEvent('camera-speed-change', {
        detail: { speed: speedRef.current, minSpeed: MIN_FLY_SPEED, maxSpeed: MAX_FLY_SPEED },
      }));
    };

    const handleContextMenu = (event: Event): void => {
      if (flyingRef.current) event.preventDefault();
    };

    const handleBlur = (): void => stopFlying();

    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      stopFlying();
      stopFrameLoop();
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [canvas, camera, enabled, fastMultiplier, lookSpeed, onChange, orbitControls]);
};

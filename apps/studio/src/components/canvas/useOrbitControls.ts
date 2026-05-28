// GDD §6.6 Phase 6B step 3 — studio orbit camera controller.
//
// Wraps three/examples/jsm OrbitControls (MIT) so the new native runtime
// has the same mouse navigation the R3F editor used to provide. Lives in
// the studio (not three-runtime) because controllers are an editor
// concern, not an engine concern (per GDD §6.6's "engine has no
// built-in controllers" stance).
//
// Defaults match the legacy editor: orbit on left-drag, pan on right-
// drag, zoom on wheel. Damping on. Renders on demand so idle editor
// viewports do not burn frames on large 3D scenes.

import { useEffect } from 'react';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type * as THREE from 'three';

export interface UseOrbitControlsArgs {
  canvas: HTMLCanvasElement | null;
  camera: THREE.PerspectiveCamera | null;
  target?: { x: number; y: number; z: number };
  enabled?: boolean;
  onReady?: (controls: OrbitControls | null) => void;
  onChange?: () => void;
}

export const useOrbitControls = ({
  canvas,
  camera,
  target,
  enabled = true,
  onReady,
  onChange,
}: UseOrbitControlsArgs): void => {
  const targetKey = target ? `${target.x},${target.y},${target.z}` : '';
  useEffect(() => {
    if (!canvas || !camera || !enabled) return;
    const controls = new OrbitControls(camera, canvas);
    if (target) controls.target.set(target.x, target.y, target.z);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = 5000;
    controls.update();
    onReady?.(controls);
    onChange?.();

    let raf = 0;
    let settleFrames = 0;
    const tick = (): void => {
      raf = 0;
      if (controls.update()) onChange?.();
      if (settleFrames > 0) {
        settleFrames -= 1;
        raf = requestAnimationFrame(tick);
      }
    };
    const schedule = (frames: number): void => {
      settleFrames = Math.max(settleFrames, frames);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const handleChange = (): void => {
      onChange?.();
      schedule(4);
    };
    const handleStart = (): void => schedule(24);
    const handleEnd = (): void => schedule(12);
    controls.addEventListener('change', handleChange);
    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      cancelAnimationFrame(raf);
      controls.removeEventListener('change', handleChange);
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
      controls.dispose();
      onReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, camera, targetKey, enabled, onReady]);
};

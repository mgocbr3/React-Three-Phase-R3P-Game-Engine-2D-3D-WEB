// GDD §6.6 Phase 6B step 4 — selection + transform gizmo for the native
// runtime mount.
//
// Lightweight wrapper around three/examples/jsm raycaster + TransformControls
// (MIT). Click on the canvas → raycast against the active scene → attach a
// gizmo to the hit object. Drag the gizmo to translate/rotate/scale.
// OrbitControls is suspended while the gizmo is being dragged so the camera
// doesn't fight the user.
//
// Persistence via @pixlland/engine-ops.object.setTransform is Phase 6B
// step 5 — for now the mutation lives only on the local THREE scene.

import { useEffect, useRef, useState } from 'react';

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export interface UseSelectionGizmoArgs {
  canvas: HTMLCanvasElement | null;
  camera: THREE.PerspectiveCamera | null;
  scene: THREE.Scene | null;
  /** Pass `window.__pixlOrbitControls` once present — auto-suspends during drag. */
  orbitControls?: OrbitControls | null;
  mode?: GizmoMode;
  enabled?: boolean;
  /**
   * Externally-driven selection (e.g. the editor's hierarchy panel sets this
   * via `useEditorStore.selectedObjectId`). When provided, the gizmo attaches
   * to this object regardless of canvas raycast. Passing `null` detaches.
   */
  externalSelected?: THREE.Object3D | null;
  onSelectionChange?: (object: THREE.Object3D | null) => void;
}

export const useSelectionGizmo = ({
  canvas,
  camera,
  scene,
  orbitControls,
  mode = 'translate',
  enabled = true,
  externalSelected,
  onSelectionChange,
}: UseSelectionGizmoArgs): void => {
  const transformRef = useRef<TransformControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);

  // Set up the gizmo (created once per canvas/camera pair).
  useEffect(() => {
    if (!canvas || !camera || !scene || !enabled) return;
    const transform = new TransformControls(camera, canvas);
    // Phase 6B debug — strip later alongside __pixlGame / __pixlOrbitControls.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__pixlGizmo = transform;
    scene.add(transform.getHelper());

    const onDraggingChanged = (event: { value: unknown }): void => {
      if (orbitControls) orbitControls.enabled = !event.value;
    };
    transform.addEventListener('dragging-changed', onDraggingChanged);

    transformRef.current = transform;
    return () => {
      transform.removeEventListener('dragging-changed', onDraggingChanged);
      transform.detach();
      scene.remove(transform.getHelper());
      transform.dispose();
      transformRef.current = null;
    };
  }, [canvas, camera, scene, orbitControls, enabled]);

  // Update mode (translate/rotate/scale) without recreating the gizmo.
  useEffect(() => {
    const t = transformRef.current;
    if (!t) return;
    t.setMode(mode);
  }, [mode]);

  // Click-to-select via raycast against the scene root.
  useEffect(() => {
    if (!canvas || !camera || !scene || !enabled) return;
    const raycaster = raycasterRef.current;
    const ndc = new THREE.Vector2();

    const onPointerDown = (event: PointerEvent): void => {
      // Skip if the gizmo itself is being grabbed (TransformControls handles).
      if (transformRef.current && (transformRef.current as unknown as { dragging?: boolean }).dragging) return;
      // Only respond to primary mouse button.
      if (event.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      // Exclude the gizmo helper from the raycast.
      const helper = transformRef.current?.getHelper();
      const candidates: THREE.Object3D[] = [];
      scene.children.forEach((child) => {
        if (child !== helper) candidates.push(child);
      });
      const hits = raycaster.intersectObjects(candidates, true);
      const first = hits.find((h) => h.object.visible);
      const newSelection = first?.object ?? null;
      setSelected(newSelection);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
    };
  }, [canvas, camera, scene, enabled]);

  // External selection wins over internal raycast selection. This is the
  // hierarchy → gizmo bridge: when the editor's SceneGraphPanel updates
  // `useEditorStore.selectedObjectId`, the parent component looks up the
  // matching THREE.Object3D and passes it here. Without this hook, clicking
  // a row in the hierarchy never attached the native gizmo because the
  // gizmo only listened to canvas pointer-down raycasts.
  useEffect(() => {
    if (externalSelected === undefined) return; // arg not used by this caller
    setSelected(externalSelected);
  }, [externalSelected]);

  // Wire selection state → transform attach/detach + onSelectionChange.
  useEffect(() => {
    const t = transformRef.current;
    if (!t) return;
    if (selected) t.attach(selected);
    else t.detach();
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);
};

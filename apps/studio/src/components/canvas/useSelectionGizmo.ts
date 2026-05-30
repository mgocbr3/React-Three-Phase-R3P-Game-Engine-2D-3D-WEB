// Native scene selection + TransformControls bridge.
import { useEffect, useRef, useState } from 'react';

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls, TransformControlsPlane } from 'three/examples/jsm/controls/TransformControls.js';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type NativeGizmoSpace = 'world' | 'local';
export type ThreeObjectTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};
export type NativeGizmoSnapSettings = {
  snapEnabled: boolean;
  snapTranslate: number;
  snapRotate: number;
  snapScale: number;
};

const TRANSFORM_PICKER_HIT_SCALE = 1.65;

type TransformControlsWithPickers = TransformControls & {
  axis?: string | null;
  object?: THREE.Object3D;
  _gizmo?: { picker?: Partial<Record<GizmoMode, THREE.Object3D>> };
};

export interface UseSelectionGizmoArgs {
  canvas: HTMLCanvasElement | null;
  camera: THREE.PerspectiveCamera | null;
  scene: THREE.Scene | null;
  /** Native orbit controls; auto-suspends during gizmo drag. */
  orbitControls?: OrbitControls | null;
  mode?: GizmoMode;
  space?: NativeGizmoSpace;
  enabled?: boolean;
  /**
   * Externally-driven selection (e.g. the editor's hierarchy panel sets this
   * via `useEditorStore.selectedObjectId`). When provided, the gizmo attaches
   * to this object regardless of canvas raycast. Passing `null` detaches.
   */
  externalSelected?: THREE.Object3D | null;
  resolveSelectionFromObject?: (object: THREE.Object3D) => THREE.Object3D | null;
  isPreferredSelectionObject?: (object: THREE.Object3D) => boolean;
  onSelectionChange?: (object: THREE.Object3D | null) => void;
  onSelectionFocus?: (object: THREE.Object3D) => void;
  onTransformChange?: (object: THREE.Object3D, transform: ThreeObjectTransform) => void;
  onTransformCommit?: (object: THREE.Object3D, transform: ThreeObjectTransform) => void;
  onChange?: () => void;
  snapSettings?: NativeGizmoSnapSettings;
}

const validSnap = (value: number): number | null => (
  Number.isFinite(value) && value > 0 ? value : null
);

export const getNativeGizmoSnapConfig = ({
  snapEnabled,
  snapTranslate,
  snapRotate,
  snapScale,
}: NativeGizmoSnapSettings) => {
  if (!snapEnabled) return { translation: null, rotation: null, scale: null };
  return {
    translation: validSnap(snapTranslate),
    rotation: validSnap(snapRotate) == null ? null : THREE.MathUtils.degToRad(snapRotate),
    scale: validSnap(snapScale),
  };
};

export const getNativeGizmoTransformSpace = (
  space: NativeGizmoSpace | null | undefined,
): NativeGizmoSpace => (space === 'local' ? 'local' : 'world');

export const getThreeObjectTransform = (object: THREE.Object3D): ThreeObjectTransform => ({
  position: [object.position.x, object.position.y, object.position.z],
  rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
  scale: [object.scale.x, object.scale.y, object.scale.z],
});

const tupleChanged = (
  a: readonly number[],
  b: readonly number[],
  epsilon = 0.0001,
): boolean => a.length !== b.length || a.some((value, index) => Math.abs(value - b[index]) > epsilon);

export const hasThreeObjectTransformChanged = (
  before: ThreeObjectTransform,
  after: ThreeObjectTransform,
): boolean => (
  tupleChanged(before.position, after.position) ||
  tupleChanged(before.rotation, after.rotation) ||
  tupleChanged(before.scale, after.scale)
);

export const getPixlObjectIdFromThreeObject = (object: THREE.Object3D | null | undefined): string | null => {
  const userData = object?.userData as {
    pixlObjectId?: unknown;
    pixlId?: unknown;
  } | undefined;
  for (const value of [userData?.pixlObjectId, userData?.pixlId]) {
    if (typeof value === 'string' && value) return value;
  }
  return null;
};

export const isNativeEditorHelperObject = (
  object: THREE.Object3D | null | undefined,
  scene?: THREE.Scene | null,
): boolean => {
  let current: THREE.Object3D | null | undefined = object;
  while (current) {
    if (current.userData?.pixlEditorHelper === true) return true;
    if (scene && current === scene) return false;
    current = current.parent;
  }
  return false;
};

export const resolveSelectableObject = (
  object: THREE.Object3D | null | undefined,
  scene?: THREE.Scene | null,
): THREE.Object3D | null => {
  if (isNativeEditorHelperObject(object, scene)) return null;
  let current: THREE.Object3D | null | undefined = object;
  while (current) {
    if (getPixlObjectIdFromThreeObject(current)) {
      return current;
    }
    if (scene && current === scene) break;
    current = current.parent;
  }
  return null;
};

export const resolveSelectionFromRaycastHits = (
  hits: THREE.Intersection[],
  scene?: THREE.Scene | null,
  resolveSelectionFromObject?: (object: THREE.Object3D) => THREE.Object3D | null,
  isPreferredSelectionObject?: (object: THREE.Object3D) => boolean,
): THREE.Object3D | null => {
  let fallback: THREE.Object3D | null = null;
  for (const hit of hits) {
    if (hit.object instanceof TransformControlsPlane) continue;
    if (!hit.object.visible) continue;
    if (isNativeEditorHelperObject(hit.object, scene)) continue;
    const selection = resolveSelectionFromObject?.(hit.object) ?? resolveSelectableObject(hit.object, scene);
    if (!selection) continue;
    if (!isPreferredSelectionObject) return selection;
    fallback ??= selection;
    if (isPreferredSelectionObject(selection)) return selection;
  }
  return fallback;
};

const findVisibleTransformHit = (
  raycaster: THREE.Raycaster,
  helper: THREE.Object3D | null | undefined,
  active = true,
): THREE.Intersection | null => {
  if (!helper || !active) return null;
  return raycaster.intersectObject(helper, true).find((hit) => {
    let current: THREE.Object3D | null = hit.object;
    while (current && current !== helper) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return current === helper;
  }) ?? null;
};

export const rayHitsTransformHelper = (
  raycaster: THREE.Raycaster,
  helper: THREE.Object3D | null | undefined,
  active = true,
): boolean => {
  return Boolean(findVisibleTransformHit(raycaster, helper, active));
};

export const findTransformPickerHitAxis = (
  raycaster: THREE.Raycaster,
  picker: THREE.Object3D | null | undefined,
  active = true,
): string | null => {
  return findVisibleTransformHit(raycaster, picker, active)?.object.name ?? null;
};

export const enlargeTransformPickerHitArea = (
  pickers: Array<THREE.Object3D | null | undefined>,
  scale = TRANSFORM_PICKER_HIT_SCALE,
): void => {
  pickers.forEach((picker) => {
    if (!picker) return;
    picker.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.geometry || mesh.userData.pixlPickerHitScale === scale) return;
      mesh.geometry.scale(scale, scale, scale);
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
      mesh.userData.pixlPickerHitScale = scale;
    });
    picker.updateMatrixWorld(true);
  });
};

export const useSelectionGizmo = ({
  canvas,
  camera,
  scene,
  orbitControls,
  mode = 'translate',
  space = 'world',
  enabled = true,
  externalSelected,
  resolveSelectionFromObject,
  isPreferredSelectionObject,
  onSelectionChange,
  onSelectionFocus,
  onTransformChange,
  onTransformCommit,
  onChange,
  snapSettings,
}: UseSelectionGizmoArgs): void => {
  const transformRef = useRef<TransformControls | null>(null);
  const onTransformChangeRef = useRef(onTransformChange);
  const onTransformCommitRef = useRef(onTransformCommit);
  const resolveSelectionFromObjectRef = useRef(resolveSelectionFromObject);
  const isPreferredSelectionObjectRef = useRef(isPreferredSelectionObject);
  const onSelectionFocusRef = useRef(onSelectionFocus);
  const onChangeRef = useRef(onChange);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  }, [onTransformChange]);

  useEffect(() => {
    onTransformCommitRef.current = onTransformCommit;
  }, [onTransformCommit]);

  useEffect(() => {
    resolveSelectionFromObjectRef.current = resolveSelectionFromObject;
  }, [resolveSelectionFromObject]);

  useEffect(() => {
    isPreferredSelectionObjectRef.current = isPreferredSelectionObject;
  }, [isPreferredSelectionObject]);

  useEffect(() => {
    onSelectionFocusRef.current = onSelectionFocus;
  }, [onSelectionFocus]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Set up the gizmo (created once per canvas/camera pair).
  useEffect(() => {
    if (!canvas || !camera || !scene || !enabled) return;
    const transform = new TransformControls(camera, canvas);
    const transformWithPickers = transform as TransformControlsWithPickers;
    enlargeTransformPickerHitArea(Object.values(transformWithPickers._gizmo?.picker ?? {}));
    transform.setSize(0.5);
    scene.add(transform.getHelper());

    const onMouseDown = (): void => {
      if (orbitControls) orbitControls.enabled = false;
    };
    const onMouseUp = (): void => {
      if (orbitControls) orbitControls.enabled = true;
      onChangeRef.current?.();
      if (transform.object) {
        onTransformCommitRef.current?.(transform.object, getThreeObjectTransform(transform.object));
      }
    };
    const onChangeEvent = (): void => {
      onChangeRef.current?.();
      if (!transform.object) return;
      onTransformChangeRef.current?.(transform.object, getThreeObjectTransform(transform.object));
    };
    transform.addEventListener('mouseDown', onMouseDown);
    transform.addEventListener('mouseUp', onMouseUp);
    transform.addEventListener('change', onChangeEvent);

    transformRef.current = transform;
    return () => {
      transform.removeEventListener('mouseDown', onMouseDown);
      transform.removeEventListener('mouseUp', onMouseUp);
      transform.removeEventListener('change', onChangeEvent);
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
    onChangeRef.current?.();
  }, [mode]);

  useEffect(() => {
    const t = transformRef.current;
    if (!t) return;
    t.setSpace(getNativeGizmoTransformSpace(space));
    onChangeRef.current?.();
  }, [space]);

  useEffect(() => {
    const t = transformRef.current;
    if (!t || !snapSettings) return;
    const snap = getNativeGizmoSnapConfig(snapSettings);
    t.setTranslationSnap(snap.translation);
    t.setRotationSnap(snap.rotation);
    t.setScaleSnap(snap.scale);
    onChangeRef.current?.();
  }, [snapSettings?.snapEnabled, snapSettings?.snapTranslate, snapSettings?.snapRotate, snapSettings?.snapScale]);

  // Click-to-select via raycast against the scene root.
  // Mirrors Wes' scene_editor/MainArea.jsx flow: intersect scene,
  // ignore TransformControlsPlane, pick first valid GameObject.
  useEffect(() => {
    if (!canvas || !camera || !scene || !enabled) return;
    const raycaster = raycasterRef.current;
    const ndc = new THREE.Vector2();

    const syncRaycasterFromPointer = (event: { clientX: number; clientY: number }): void => {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
    };

    const resolveSelectionFromPointer = (event: { clientX: number; clientY: number }): THREE.Object3D | null => {
      syncRaycasterFromPointer(event);
      const hits = raycaster.intersectObject(scene, true);
      return resolveSelectionFromRaycastHits(
        hits,
        scene,
        resolveSelectionFromObjectRef.current,
        isPreferredSelectionObjectRef.current,
      );
    };

    const onCanvasPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      syncRaycasterFromPointer(event);
      const transform = transformRef.current;
      if (transform && rayHitsTransformHelper(raycaster, transform.getHelper(), Boolean(transform.object))) return;
      if (!resolveSelectionFromPointer(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onCanvasClick = (event: MouseEvent): void => {
      if (event.button !== 0) return;
      const newSelection = resolveSelectionFromPointer(event);
      if (!newSelection) return;
      setSelected(newSelection);
      onChangeRef.current?.();
    };

    const onCanvasDoubleClick = (event: MouseEvent): void => {
      if (event.button !== 0) return;
      const newSelection = resolveSelectionFromPointer(event);
      if (!newSelection) return;
      setSelected(newSelection);
      onSelectionFocusRef.current?.(newSelection);
      onChangeRef.current?.();
    };

    canvas.addEventListener('pointerdown', onCanvasPointerDown, { capture: true });
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('dblclick', onCanvasDoubleClick);
    return () => {
      canvas.removeEventListener('pointerdown', onCanvasPointerDown, { capture: true });
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('dblclick', onCanvasDoubleClick);
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
    onChangeRef.current?.();
  }, [externalSelected]);

  // Wire selection state → transform attach/detach + onSelectionChange.
  useEffect(() => {
    const t = transformRef.current;
    if (!t) return;
    if (selected) t.attach(selected);
    else t.detach();
    onSelectionChange?.(selected);
    onChangeRef.current?.();
  }, [selected, onSelectionChange]);
};

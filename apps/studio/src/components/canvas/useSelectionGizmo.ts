// Native scene selection + TransformControls bridge.
import { useEffect, useRef, useState } from 'react';

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

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
  onSelectionChange?: (object: THREE.Object3D | null) => void;
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
    gameObjectID?: unknown;
  } | undefined;
  for (const value of [userData?.pixlObjectId, userData?.pixlId, userData?.gameObjectID]) {
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
    const userData = current.userData as {
      pixlObjectId?: unknown;
      pixlId?: unknown;
      gameObjectID?: unknown;
    };
    if (getPixlObjectIdFromThreeObject(current)) {
      return current;
    }
    if (scene && current === scene) break;
    current = current.parent;
  }
  return object ?? null;
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
  onSelectionChange,
  onTransformCommit,
  onChange,
  snapSettings,
}: UseSelectionGizmoArgs): void => {
  const transformRef = useRef<TransformControls | null>(null);
  const onTransformCommitRef = useRef(onTransformCommit);
  const onChangeRef = useRef(onChange);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    onTransformCommitRef.current = onTransformCommit;
  }, [onTransformCommit]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Set up the gizmo (created once per canvas/camera pair).
  useEffect(() => {
    if (!canvas || !camera || !scene || !enabled) return;
    const transform = new TransformControls(camera, canvas);
    const transformWithPickers = transform as TransformControlsWithPickers;
    enlargeTransformPickerHitArea(Object.values(transformWithPickers._gizmo?.picker ?? {}));
    scene.add(transform.getHelper());

    const onDraggingChanged = (event: { value: unknown }): void => {
      if (orbitControls) orbitControls.enabled = !event.value;
      onChangeRef.current?.();
      if (!event.value && transform.object) {
        onTransformCommitRef.current?.(transform.object, getThreeObjectTransform(transform.object));
      }
    };
    const requestRender = (): void => onChangeRef.current?.();
    transform.addEventListener('dragging-changed', onDraggingChanged);
    transform.addEventListener('change', requestRender);
    transform.addEventListener('objectChange', requestRender);

    transformRef.current = transform;
    return () => {
      transform.removeEventListener('dragging-changed', onDraggingChanged);
      transform.removeEventListener('change', requestRender);
      transform.removeEventListener('objectChange', requestRender);
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
  useEffect(() => {
    if (!canvas || !camera || !scene || !enabled) return;
    const raycaster = raycasterRef.current;
    const ndc = new THREE.Vector2();

    const syncRaycasterFromPointer = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
    };

    const getActivePicker = (): {
      helper: THREE.Object3D | undefined;
      picker: THREE.Object3D | undefined;
      transform: TransformControlsWithPickers | null;
    } => {
      const transform = transformRef.current as TransformControlsWithPickers | null;
      const helper = transform?.getHelper();
      const picker = transform?._gizmo?.picker?.[mode] ?? helper;
      return { helper, picker, transform };
    };

    const onPointerDownCapture = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const { picker, transform } = getActivePicker();
      if (!transform?.object) return;
      syncRaycasterFromPointer(event);
      const axis = findTransformPickerHitAxis(raycaster, picker, true);
      transform.axis = axis as TransformControls['axis'];
    };

    const onPointerDown = (event: PointerEvent): void => {
      // Skip if the gizmo itself is being grabbed (TransformControls handles).
      if (transformRef.current && (transformRef.current as unknown as { dragging?: boolean }).dragging) return;
      // Only respond to primary mouse button.
      if (event.button !== 0) return;
      syncRaycasterFromPointer(event);
      const { helper, picker, transform } = getActivePicker();
      if (rayHitsTransformHelper(raycaster, picker, Boolean(transform?.object))) {
        return;
      }

      // Exclude the gizmo helper from the scene-object raycast.
      const candidates: THREE.Object3D[] = [];
      scene.children.forEach((child) => {
        if (child !== helper) candidates.push(child);
      });
      const hits = raycaster.intersectObjects(candidates, true);
      const first = hits.find((h) => h.object.visible && !isNativeEditorHelperObject(h.object, scene));
      const newSelection = resolveSelectableObject(first?.object, scene);
      setSelected(newSelection);
      onChangeRef.current?.();
    };

    canvas.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    canvas.addEventListener('pointerdown', onPointerDown);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDownCapture, { capture: true });
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

// Native Three.js editor/runtime mount.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Game, type RendererPostProcessingOptions } from '@pixlland/three-runtime';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { useEditorStore } from '@/stores/editorStore';
import { useEngineSettings, type EngineSettings } from '@/stores/engineSettingsStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import type { PixlProjectDocument } from '@/engine/project/schema';
import { loadProjectDocSnapshot } from '@/services/projectDocStorage';
import { mergeSnapshotOntoFresh } from '@/services/snapshotMerge';
import { useOrbitControls } from './useOrbitControls';
import { useNativeFlyCamera } from './useNativeFlyCamera';
import {
  getPixlObjectIdFromThreeObject,
  hasThreeObjectTransformChanged,
  resolveSelectableObject,
  useSelectionGizmo,
  type GizmoMode,
  type ThreeObjectTransform,
} from './useSelectionGizmo';

export interface ThreeRuntimeMountProps {
  /** display: block when true, none when false. Both mounts live in the DOM. */
  visible: boolean;
  /** URL or relative path to the project root. Used by the runtime's AssetSource. */
  assetBaseUrl?: string;
  /** Active editor project document. When provided, no default sample is fetched. */
  projectDocument?: PixlProjectDocument | null;
  /** Initial scene name to load. */
  initialScene?: string;
  /** Transform gizmo mode. */
  gizmoMode?: GizmoMode;
}

interface LoadState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
}

const DEFAULT_BASE_URL = '/sample-projects/harvest-rush-3d';
const DEFAULT_SCENE: string | undefined = undefined; // let project.activeSceneId pick
const HELPER_USER_DATA = { pixlEditorHelper: true };
type SceneAxisView = 'x' | 'y' | 'z' | 'free';
type ThreeTransformShortcutMode = 'translate' | 'rotate' | 'scale';
type SceneAxisPose = { position: [number, number, number]; up: [number, number, number] };
type SceneViewShortcutInput = Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;
type ThreeEditorPlacementApi = {
  getAddObjectPosition: () => [number, number, number] | undefined;
  getCameraPose: () => {
    position: [number, number, number];
    target: [number, number, number] | null;
    quaternion: [number, number, number, number];
  } | null;
};
type ThreeCameraTarget = { x: number; y: number; z: number };
type ThreeNativeRenderSettings = Pick<
  EngineSettings,
  | 'toneMapping'
  | 'toneMappingExposure'
  | 'bloom'
  | 'bloomIntensity'
  | 'bloomThreshold'
  | 'bloomRadius'
  | 'colorGrading'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hue'
  | 'dpr'
  | 'maxDpr'
>;

const sceneAxisLabels: Record<SceneAxisView, string> = {
  x: 'Right View',
  y: 'Top View',
  z: 'Front View',
  free: 'Free View',
};

const isEditableSceneShortcutTarget = (target: EventTarget | null) => {
  const el = target instanceof HTMLElement ? target : null;
  return !!el && (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el.isContentEditable ||
    !!el.closest('[contenteditable]:not([contenteditable="false"])')
  );
};

export const getThreeSceneViewShortcut = (event: Partial<SceneViewShortcutInput>): SceneAxisView | null => (
  (void event, null)
);

export const getThreeTransformShortcutMode = (
  event: Partial<Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey'>>,
): ThreeTransformShortcutMode | null => {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.code === 'KeyR') return 'rotate';
  if (event.code === 'KeyS') return 'scale';
  if (event.code === 'KeyT' || event.code === 'KeyP') return 'translate';
  return null;
};

const styleHelperMaterials = (
  object: THREE.Object3D,
  opacity: number,
  options: { depthTest?: boolean; depthWrite?: boolean } = {},
): void => {
  const material = (object as THREE.LineSegments).material as THREE.Material | THREE.Material[] | undefined;
  const materials = Array.isArray(material) ? material : material ? [material] : [];
  materials.forEach((item) => {
    item.transparent = true;
    item.opacity = opacity;
    item.depthTest = options.depthTest ?? true;
    item.depthWrite = options.depthWrite ?? false;
  });
};

const num = (value: number | undefined, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);
const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const resolveThreeRuntimeAssetBaseUrl = (
  assetBaseUrl: string | undefined,
  projectDocument: unknown,
): string => assetBaseUrl ?? (projectDocument ? '/' : DEFAULT_BASE_URL);

export const getThreeNativePixelRatio = (
  settings: Pick<EngineSettings, 'dpr' | 'maxDpr'>,
  devicePixelRatio = 1,
): number => {
  const dpr = clampNumber(num(settings.dpr, 1), 0.5, 2);
  const maxDpr = clampNumber(num(settings.maxDpr, 2), 0.5, 3);
  return clampNumber(devicePixelRatio * dpr, 0.5, maxDpr);
};

export const createThreeNativePostProcessingOptions = (
  settings: ThreeNativeRenderSettings,
  enabled = true,
): RendererPostProcessingOptions => {
  void settings;
  void enabled;
  return {
    enabled: false,
    toneMapping: 'none',
    toneMappingExposure: 1,
    bloom: false,
    bloomIntensity: 0,
    bloomThreshold: 1,
    bloomRadius: 0,
    colorGrading: false,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
  };
};

export const getThreeNativePostProcessingEffects = (
  options: RendererPostProcessingOptions,
): string => (
  options.enabled === false
    ? 'off'
    : [
      options.toneMapping && options.toneMapping !== 'none' ? `tone:${options.toneMapping}` : null,
      options.bloom ? 'bloom' : null,
      options.colorGrading ? 'grade' : null,
    ].filter(Boolean).join(',')
);

const fetchPixlProject = async (baseUrl: string): Promise<unknown> => {
  const url = `${baseUrl.replace(/\/$/, '')}/project.pixlproject.json`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`project.pixlproject.json: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

type ThreeRuntimeScriptTick = (ctx: { deltaTimeInSec: number; time: number }) => void;

type ThreeRuntimeScriptSetupContext = {
  game: Game;
  scene: NonNullable<Game['scene']>;
  THREE: typeof THREE;
  project: unknown;
  activeScene: Record<string, unknown>;
  canvas: HTMLCanvasElement;
  mount: HTMLElement | null;
  getObject3DById: (id: string) => THREE.Object3D | null;
};

const installThreeRuntimeScript = async ({
  game,
  project,
  activeScene,
  assetBaseUrl,
  canvas,
  setTick,
}: {
  game: Game;
  project: unknown;
  activeScene: Record<string, unknown>;
  assetBaseUrl: string;
  canvas: HTMLCanvasElement;
  setTick: (tick: ThreeRuntimeScriptTick | null, dispose?: (() => void) | null) => void;
}): Promise<void> => {
  const scriptPath = activeScene.runtimeScript;
  if (typeof scriptPath !== 'string' || !scriptPath.trim()) {
    setTick(null, null);
    return;
  }

  const sceneRef = game.scene;
  if (!sceneRef) {
    setTick(null, null);
    return;
  }

  const getObject3DById = (id: string): THREE.Object3D | null => {
    let found: THREE.Object3D | null = null;
    sceneRef.threeJSScene.traverse((object) => {
      if (found) return;
      const ud = object.userData as { pixlObjectId?: string; pixlId?: string } | undefined;
      if (ud?.pixlObjectId === id || ud?.pixlId === id) {
        found = object;
      }
    });
    return found;
  };

  const fullUrl = `${assetBaseUrl.replace(/\/$/, '')}/${scriptPath}?t=${Date.now()}`;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`runtimeScript fetch ${response.status} ${response.statusText} for ${fullUrl}`);
  }
  const code = await response.text();
  const blob = new Blob([code], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const mod = await import(/* @vite-ignore */ blobUrl) as { default?: unknown; setup?: unknown };
    const setup = (mod.default ?? mod.setup) as ((ctx: ThreeRuntimeScriptSetupContext) => unknown) | undefined;
    if (typeof setup !== 'function') {
      setTick(null, null);
      return;
    }

    const ret = setup({
      game,
      scene: sceneRef,
      THREE,
      project,
      activeScene,
      canvas,
      mount: canvas.parentElement,
      getObject3DById,
    });

    if (typeof ret === 'function') {
      setTick((ctx) => {
        (ret as (deltaTimeInSec: number, time: number) => void)(ctx.deltaTimeInSec, ctx.time);
      }, null);
      return;
    }

    if (ret && typeof ret === 'object') {
      const obj = ret as { tick?: unknown; dispose?: unknown };
      const tick = typeof obj.tick === 'function'
        ? ((ctx: { deltaTimeInSec: number; time: number }) => {
          (obj.tick as (deltaTimeInSec: number, time: number) => void)(ctx.deltaTimeInSec, ctx.time);
        })
        : null;
      const dispose = typeof obj.dispose === 'function' ? (obj.dispose as () => void) : null;
      setTick(tick, dispose);
      return;
    }

    setTick(null, null);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

type EditorObjectSummary = {
  id: string;
  name?: string;
  type?: string;
};

export const shouldEnableThreeEditorTools = ({
  visible,
  isRuntimePreview,
}: {
  visible: boolean;
  isRuntimePreview: boolean;
}) => visible && !isRuntimePreview;

export const shouldRunThreeRuntimeSimulation = ({
  visible,
  isRuntimePreview,
  loadStatus,
}: {
  visible: boolean;
  isRuntimePreview: boolean;
  loadStatus: LoadState['status'];
}) => visible && isRuntimePreview && loadStatus === 'ready';

export const shouldRunThreeEditorRenderLoop = ({
  visible,
  editorToolsEnabled,
  loadStatus,
}: {
  visible: boolean;
  editorToolsEnabled: boolean;
  loadStatus: LoadState['status'];
}) => visible && editorToolsEnabled && loadStatus === 'ready';

export const findThreeObjectForEditorSelection = (
  threeScene: THREE.Scene | null,
  selectedObjectId: string | null,
  storeObjects: EditorObjectSummary[],
): THREE.Object3D | null => {
  if (!threeScene || !selectedObjectId) return null;

  let match: THREE.Object3D | null = null;
  threeScene.traverse((obj) => {
    if (match) return;
    const ud = obj.userData as { pixlObjectId?: string; pixlId?: string } | undefined;
    if (ud?.pixlObjectId === selectedObjectId || ud?.pixlId === selectedObjectId) {
      match = obj;
      return;
    }
    if (obj.name && obj.name === selectedObjectId) {
      match = obj;
    }
  });

  if (!match) {
    const storeObj = storeObjects.find((object) => object.id === selectedObjectId);
    const storeName = storeObj?.name;
    if (storeName) {
      const prefixed = `gameObject-${storeName}`;
      threeScene.traverse((obj) => {
        if (match) return;
        if (obj.name === storeName || obj.name === prefixed) match = obj;
      });
    }
  }

  return resolveSelectableObject(match, threeScene);
};

export const getEditorObjectIdForNativeSelection = (
  object: THREE.Object3D | null,
): string | null => getPixlObjectIdFromThreeObject(object);

export const hasEditorObjectId = (
  storeObjects: EditorObjectSummary[],
  objectId: string | null,
): boolean => Boolean(objectId && storeObjects.some((object) => object.id === objectId));

export const isPreferredEditorSelectionObject = (
  storeObjects: EditorObjectSummary[],
  object: THREE.Object3D | null,
): boolean => {
  const objectId = getPixlObjectIdFromThreeObject(object);
  const editorObject = storeObjects.find((item) => item.id === objectId);
  if (!editorObject) return false;
  const name = editorObject.name?.toLowerCase() ?? '';
  return editorObject.type !== 'plane'
    && editorObject.type !== 'terrain'
    && name !== 'ground'
    && !name.includes('terrain');
};

export const getThreeEditorGridConfig = (gridSize: number) => {
  const requestedSize = Math.max(16, Number.isFinite(gridSize) ? Math.abs(gridSize) : 100);
  const size = Math.max(2048, Math.min(8192, requestedSize * 32));
  const cellSize = Math.max(1, Math.min(4, Math.round(requestedSize / 160) || 1));
  return { size, divisions: Math.max(512, Math.min(2048, Math.round(size / cellSize))), cellSize };
};

export const syncThreeEditorInfiniteGrid = (
  grid: THREE.Object3D | null | undefined,
  camera: THREE.Camera | null | undefined,
  cellSize = 1,
): boolean => {
  if (!grid || !camera) return false;
  const step = Math.max(1, Number.isFinite(cellSize) ? Math.abs(cellSize) : 1);
  const nextX = Math.round(camera.position.x / step) * step;
  const nextZ = Math.round(camera.position.z / step) * step;
  if (Math.abs(grid.position.x - nextX) < 0.0001 && Math.abs(grid.position.z - nextZ) < 0.0001) {
    return false;
  }
  grid.position.x = nextX;
  grid.position.z = nextZ;
  return true;
};

export const getThreeSceneAxisView = (
  axis: SceneAxisView,
  target: THREE.Vector3,
  distance: number,
): SceneAxisPose => {
  const safeDistance = Math.max(1, Number.isFinite(distance) ? distance : 10);
  const offsets: Record<SceneAxisView, THREE.Vector3> = {
    x: new THREE.Vector3(safeDistance, 0, 0),
    y: new THREE.Vector3(0, safeDistance, 0),
    z: new THREE.Vector3(0, 0, safeDistance),
    free: new THREE.Vector3(5, 4, 8).normalize().multiplyScalar(safeDistance),
  };
  const ups: Record<SceneAxisView, [number, number, number]> = {
    x: [0, 1, 0],
    y: [0, 0, -1],
    z: [0, 1, 0],
    free: [0, 1, 0],
  };
  const position = target.clone().add(offsets[axis]);
  return { position: [position.x, position.y, position.z], up: ups[axis] };
};

export const getThreeAddObjectPosition = (
  pivot: THREE.Vector3 | null | undefined,
  camera: THREE.Camera | null | undefined,
  distance = 6,
): [number, number, number] | undefined => {
  if (pivot && Number.isFinite(pivot.x) && Number.isFinite(pivot.y) && Number.isFinite(pivot.z)) {
    return [pivot.x, pivot.y, pivot.z];
  }
  if (!camera) return undefined;
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  if (!Number.isFinite(direction.lengthSq()) || direction.lengthSq() < 0.0001) return undefined;
  const safeDistance = Math.max(1, Number.isFinite(distance) ? distance : 6);
  const position = camera.position.clone().addScaledVector(direction.normalize(), safeDistance);
  return [position.x, position.y, position.z];
};

export const getThreeCameraTarget = (value: unknown): ThreeCameraTarget => {
  const source = Array.isArray(value)
    ? { x: value[0], y: value[1], z: value[2] }
    : value && typeof value === 'object'
      ? value as Partial<ThreeCameraTarget>
      : {};
  return {
    x: Number.isFinite(source.x) ? source.x as number : 0,
    y: Number.isFinite(source.y) ? source.y as number : 0,
    z: Number.isFinite(source.z) ? source.z as number : 0,
  };
};

export const hasThreeNativeSky = (scene: THREE.Scene | null): boolean => {
  let found = false;
  scene?.traverse((child) => {
    if (child.userData.pixlSky) found = true;
  });
  return found;
};

export const createThreeEditorSceneHelpers = ({
  showGrid,
  showAxes,
  gridSize,
}: {
  showGrid: boolean;
  showAxes: boolean;
  gridSize: number;
}): THREE.Group => {
  const root = new THREE.Group();
  root.name = 'Pixl Editor 3D Helpers';
  root.userData = { ...HELPER_USER_DATA };

  if (showGrid) {
    const { size, divisions, cellSize } = getThreeEditorGridConfig(gridSize);
    const grid = new THREE.GridHelper(size, divisions, '#8b949e', '#3f4750');
    grid.name = 'Editor Grid';
    grid.position.y = 0.01;
    grid.renderOrder = -1;
    grid.frustumCulled = false;
    grid.userData = { ...HELPER_USER_DATA, pixlInfiniteGridCellSize: cellSize };
    styleHelperMaterials(grid, 0.12, { depthTest: true, depthWrite: false });
    root.add(grid);
  }

  if (showAxes) {
    const axes = new THREE.AxesHelper(Math.min(8, Math.max(3, gridSize * 0.05)));
    axes.name = 'Editor Axes';
    axes.position.y = 0.06;
    axes.renderOrder = 1000;
    axes.userData = { ...HELPER_USER_DATA };
    styleHelperMaterials(axes, 0.85, { depthTest: false, depthWrite: false });
    root.add(axes);
  }

  root.traverse((object) => {
    object.userData = { ...object.userData, ...HELPER_USER_DATA };
  });
  return root;
};

const getFrameForObject = (
  object: THREE.Object3D | null,
  fallbackPosition: [number, number, number],
  fallbackDistance: number | undefined,
): { center: THREE.Vector3; distance: number } => {
  const center = new THREE.Vector3(...fallbackPosition);
  let distance = fallbackDistance ?? 10;

  if (!object) {
    return { center, distance };
  }

  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3()).length();
    distance = fallbackDistance ?? Math.max(size * 1.15, 1.5);
  } else {
    const elements = object.matrixWorld.elements;
    center.set(elements[12] ?? fallbackPosition[0], elements[13] ?? fallbackPosition[1], elements[14] ?? fallbackPosition[2]);
  }

  return { center, distance };
};

export function ThreeRuntimeMount({
  visible,
  assetBaseUrl,
  projectDocument = null,
  initialScene = DEFAULT_SCENE,
  gizmoMode = 'translate',
}: ThreeRuntimeMountProps): React.JSX.Element {
  const resolvedAssetBaseUrl = resolveThreeRuntimeAssetBaseUrl(assetBaseUrl, projectDocument);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mirrored as state so React re-renders (and the orbit-controls hook re-
  // runs) when the canvas mounts. A pure ref doesn't trigger renders.
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const editorRenderFrameRef = useRef<number>(0);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [sceneAxisView, setSceneAxisView] = useState<SceneAxisView>('free');
  // Captured once the runtime's renderer is constructed. The orbit
  // controls hook activates when both fields are set.
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [orbitTarget, setOrbitTarget] = useState<{ x: number; y: number; z: number } | undefined>(undefined);
  const [orbitControlsInstance, setOrbitControlsInstance] = useState<OrbitControls | null>(null);
  const editorGridRef = useRef<THREE.Object3D | null>(null);
  const editorGridCellSizeRef = useRef<number>(1);
  const isRuntimePreview = useRuntimeGameStore((state) => state.isPlaying || Boolean(state.previewSession));
  const editorToolsEnabled = shouldEnableThreeEditorTools({ visible, isRuntimePreview });
  const requestEditorRender = useCallback(() => {
    if (!shouldRunThreeEditorRenderLoop({ visible, editorToolsEnabled, loadStatus: load.status })) return;
    if (editorRenderFrameRef.current) return;
    editorRenderFrameRef.current = requestAnimationFrame(() => {
      editorRenderFrameRef.current = 0;
      syncThreeEditorInfiniteGrid(editorGridRef.current, camera, editorGridCellSizeRef.current);
      gameRef.current?.renderStillFrame();
    });
  }, [camera, editorToolsEnabled, load.status, visible]);

  useOrbitControls({
    canvas: canvasEl,
    camera,
    target: orbitTarget,
    enabled: editorToolsEnabled,
    onReady: setOrbitControlsInstance,
    onChange: requestEditorRender,
  });

  useNativeFlyCamera({
    canvas: canvasEl,
    camera,
    orbitControls: orbitControlsInstance,
    enabled: editorToolsEnabled,
    speed: 14,
    fastMultiplier: 2.5,
    lookSpeed: 0.003,
    onChange: requestEditorRender,
  });

  // Three scene reference for raycasting; captured from game.scene.threeJSScene
  // when the load resolves.
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null);
  const hasNativeSky = hasThreeNativeSky(threeScene);
  const showGrid = useEngineSettings((state) => state.showGrid);
  const showAxes = useEngineSettings((state) => state.showGizmo);
  const gridSize = useEngineSettings((state) => state.gridSize);
  const renderSettings = useEngineSettings();
  const runSimulation = shouldRunThreeRuntimeSimulation({ visible, isRuntimePreview, loadStatus: load.status });
  const nativePostProcessing = useMemo(
    () => createThreeNativePostProcessingOptions(renderSettings, runSimulation),
    [renderSettings, runSimulation],
  );
  const nativePostProcessingEffects = useMemo(
    () => getThreeNativePostProcessingEffects(nativePostProcessing),
    [nativePostProcessing],
  );
  const runtimeScriptTickRef = useRef<ThreeRuntimeScriptTick | null>(null);
  const runtimeScriptDisposeRef = useRef<(() => void) | null>(null);

  // Subscribe directly to the editor store so the toolbar's
  // Move(W)/Rotate(E)/Scale(R) buttons reach the native runtime gizmo. Prior
  // behavior: `gizmoMode` prop was never wired by any parent, so the prop
  // default (`'translate'`) made the gizmo permanently stuck on translate
  // even though `useEditorStore.transformMode` updated correctly. The toolbar
  // appeared to do nothing in the native engine path because the props chain
  // didn't reach this component.
  const storeTransformMode = useEditorStore((state) => state.transformMode);
  const transformSpace = useEditorStore((state) => state.transformSpace);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const snapTranslate = useEditorStore((state) => state.snapTranslate);
  const snapRotate = useEditorStore((state) => state.snapRotate);
  const snapScale = useEditorStore((state) => state.snapScale);
  // The store distinguishes a 4th 'select' mode (camera-priority). For the
  // native gizmo, treat 'select' as translate behind the scenes — the hook's
  // `enabled` flag would also tear it down, but we keep the controls alive
  // so the selection state survives mode toggles.
  const effectiveGizmoMode: GizmoMode =
    storeTransformMode === 'rotate' || storeTransformMode === 'scale'
      ? storeTransformMode
      : 'translate';
  // gizmoMode prop is kept for backwards compat but the store wins when both
  // are present. If neither is set, fall back to gizmoMode (which itself
  // defaults to 'translate').
  void gizmoMode;

  // Hierarchy → native gizmo bridge. The SceneGraphPanel writes
  // `selectedObjectId` to the editor store; we resolve the matching
  // THREE.Object3D in the loaded scene and hand it to useSelectionGizmo.
  //
  // Matching strategy (in priority order):
  //   1. `userData.pixlObjectId` — the stable schema id stamped by the
  //      runtime adapter onto every loaded object. This is the canonical
  //      pairing and resolves things like `selectedObjectId =
  //      "farm-part-group-bus"` → the `gameObject-Bus` Group3D.
  //   2. `userData.pixlId` — older naming kept for back-compat.
  //   3. `Object3D.name` literal match against id.
  //   4. `gameObject-<displayName>` prefix match against the store
  //      object's name (the adapter prefixes group nodes that way).
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const focusTarget = useEditorStore((state) => state.focusTarget);
  const [externalSelectedThree, setExternalSelectedThree] = useState<THREE.Object3D | null>(null);
  const lastFocusFrameTimestampRef = useRef<number | null>(null);
  useEffect(() => {
    setExternalSelectedThree(findThreeObjectForEditorSelection(
      threeScene,
      selectedObjectId,
      useEditorStore.getState().objects ?? [],
    ));
  }, [selectedObjectId, threeScene]);

  useEffect(() => {
    if (!focusTarget || !camera || !orbitControlsInstance) return;
    if (lastFocusFrameTimestampRef.current === focusTarget.timestamp) return;
    lastFocusFrameTimestampRef.current = focusTarget.timestamp;

    const objectToFrame = externalSelectedThree
      ?? findThreeObjectForEditorSelection(
        threeScene,
        selectedObjectId,
        useEditorStore.getState().objects ?? [],
      );
    const { center, distance } = getFrameForObject(
      objectToFrame,
      focusTarget.position,
      focusTarget.distance,
    );
    const previousTarget = orbitControlsInstance.target instanceof THREE.Vector3
      ? orbitControlsInstance.target
      : center;
    const viewDirection = camera.position.clone().sub(previousTarget);

    if (!Number.isFinite(viewDirection.lengthSq()) || viewDirection.lengthSq() < 0.0001) {
      viewDirection.set(5, 4, 8);
    }

    viewDirection.normalize();
    camera.position.copy(center).addScaledVector(viewDirection, distance);
    camera.lookAt(center);
    orbitControlsInstance.target?.copy?.(center);
    orbitControlsInstance.update?.();
    requestEditorRender();
  }, [camera, externalSelectedThree, focusTarget, orbitControlsInstance, requestEditorRender, selectedObjectId, threeScene]);

  useEffect(() => {
    if (typeof window === 'undefined' || !editorToolsEnabled) return;
    const runtime = window as Window & { __pixlThreeEditor?: ThreeEditorPlacementApi };
    const placementApi: ThreeEditorPlacementApi = {
      getAddObjectPosition: () => {
        const target = orbitControlsInstance?.target instanceof THREE.Vector3
          ? orbitControlsInstance.target
          : orbitTarget
            ? new THREE.Vector3(orbitTarget.x, orbitTarget.y, orbitTarget.z)
            : null;
        return getThreeAddObjectPosition(target, camera);
      },
      getCameraPose: () => {
        if (!camera) return null;
        const target = orbitControlsInstance?.target instanceof THREE.Vector3
          ? orbitControlsInstance.target
          : orbitTarget
            ? new THREE.Vector3(orbitTarget.x, orbitTarget.y, orbitTarget.z)
            : null;
        return {
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: target ? [target.x, target.y, target.z] : null,
          quaternion: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w],
        };
      },
    };
    runtime.__pixlThreeEditor = placementApi;
    return () => {
      if (runtime.__pixlThreeEditor === placementApi) delete runtime.__pixlThreeEditor;
    };
  }, [camera, editorToolsEnabled, orbitControlsInstance, orbitTarget]);

  const commitNativeGizmoTransform = useCallback((object: THREE.Object3D, transform: ThreeObjectTransform) => {
    const objectId = getPixlObjectIdFromThreeObject(object) ?? selectedObjectId;
    if (!objectId) return false;
    const store = useEditorStore.getState();
    const current = store.objects.find((item) => item.id === objectId);
    if (!current || !hasThreeObjectTransformChanged(current, transform)) return false;
    store.updateObject(objectId, transform);
    return true;
  }, [selectedObjectId]);

  const syncNativeGizmoTransform = useCallback((object: THREE.Object3D, transform: ThreeObjectTransform) => {
    commitNativeGizmoTransform(object, transform);
  }, [commitNativeGizmoTransform]);

  const persistNativeGizmoTransform = useCallback((object: THREE.Object3D, transform: ThreeObjectTransform) => {
    if (!commitNativeGizmoTransform(object, transform)) return;
    useEditorStore.getState().saveToHistory();
  }, [commitNativeGizmoTransform]);

  const handleNativeSelectionChange = useCallback((object: THREE.Object3D | null) => {
    const nextObjectId = getEditorObjectIdForNativeSelection(object);
    if (!nextObjectId) return;
    const store = useEditorStore.getState();
    if (!hasEditorObjectId(store.objects, nextObjectId)) return;
    if (store.selectedObjectId !== nextObjectId) store.selectObject(nextObjectId);
  }, []);

  const handleNativeSelectionFocus = useCallback((object: THREE.Object3D) => {
    const objectId = getEditorObjectIdForNativeSelection(object);
    if (!objectId) return;
    const store = useEditorStore.getState();
    if (!hasEditorObjectId(store.objects, objectId)) return;
    if (store.selectedObjectId !== objectId) store.selectObject(objectId);
    store.focusOnObject(objectId);
  }, []);

  const resolveNativeGameObjectSelection = useCallback((object: THREE.Object3D): THREE.Object3D | null => {
    const gameObject = gameRef.current?.scene?.getGameObjectWithThreeJSObject(object);
    return gameObject?.threeJSGroup ?? null;
  }, []);

  const isPreferredNativeSelection = useCallback((object: THREE.Object3D): boolean => (
    isPreferredEditorSelectionObject(useEditorStore.getState().objects, object)
  ), []);

  const handleSceneAxisView = useCallback((axis: SceneAxisView) => {
    if (!camera) return;
    setSceneAxisView(axis);
    const target = orbitControlsInstance?.target instanceof THREE.Vector3
      ? orbitControlsInstance.target.clone()
      : new THREE.Vector3(0, 0, 0);
    const distance = camera.position.distanceTo(target);
    const pose = getThreeSceneAxisView(axis, target, distance);
    camera.position.set(...pose.position);
    camera.up.set(...pose.up);
    camera.lookAt(target);
    orbitControlsInstance?.target?.copy?.(target);
    orbitControlsInstance?.update?.();
    requestEditorRender();
  }, [camera, orbitControlsInstance, requestEditorRender]);

  useEffect(() => {
    if (!editorToolsEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableSceneShortcutTarget(event.target)) return;

      // Mirror three-game-engine scene_editor/MainArea keymap.
      // T/P => translate, R => rotate, S => scale.
      const transformMode = getThreeTransformShortcutMode(event);
      if (transformMode) {
        useEditorStore.getState().setTransformMode(transformMode);
        event.preventDefault();
        return;
      }

      if (event.code === 'Delete') {
        const store = useEditorStore.getState();
        if (store.selectedObjectId) {
          store.deleteObject(store.selectedObjectId);
          event.preventDefault();
          return;
        }
      }

    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorToolsEnabled]);

  useSelectionGizmo({
    canvas: canvasEl,
    camera,
    scene: threeScene,
    orbitControls: orbitControlsInstance,
    mode: effectiveGizmoMode,
    space: transformSpace,
    enabled: editorToolsEnabled,
    externalSelected: externalSelectedThree,
    resolveSelectionFromObject: resolveNativeGameObjectSelection,
    isPreferredSelectionObject: isPreferredNativeSelection,
    onSelectionChange: handleNativeSelectionChange,
    onSelectionFocus: handleNativeSelectionFocus,
    onTransformChange: syncNativeGizmoTransform,
    onTransformCommit: persistNativeGizmoTransform,
    onChange: requestEditorRender,
    snapSettings: { snapEnabled, snapTranslate, snapRotate, snapScale },
  });

  useEffect(() => {
    const game = gameRef.current;
    if (!game || load.status !== 'ready') return;
    game.inputManager?.setPointerLockEnabled(runSimulation);
    if (runSimulation) {
      void game.play().catch((error) => console.error('[ThreeRuntimeMount] play failed:', error));
      return;
    }
    game.pause();
    requestEditorRender();
  }, [load.status, requestEditorRender, runSimulation]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.setPostProcessingOptions(nativePostProcessing);
    if (load.status === 'ready' && !runSimulation) requestEditorRender();
  }, [load.status, nativePostProcessing, requestEditorRender, runSimulation]);

  useEffect(() => {
    requestEditorRender();
    return () => {
      if (!editorRenderFrameRef.current) return;
      cancelAnimationFrame(editorRenderFrameRef.current);
      editorRenderFrameRef.current = 0;
    };
  }, [requestEditorRender]);

  useEffect(() => {
    if (!threeScene || !editorToolsEnabled || (!showGrid && !showAxes)) return;
    const helpers = createThreeEditorSceneHelpers({ showGrid, showAxes, gridSize });
    const grid = helpers.getObjectByName('Editor Grid') ?? null;
    editorGridRef.current = grid;
    editorGridCellSizeRef.current = getThreeEditorGridConfig(gridSize).cellSize;
    syncThreeEditorInfiniteGrid(grid, camera, editorGridCellSizeRef.current);
    threeScene.add(helpers);
    requestEditorRender();
    return () => {
      threeScene.remove(helpers);
      if (editorGridRef.current === grid) editorGridRef.current = null;
      helpers.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose?.());
        else material?.dispose?.();
      });
      requestEditorRender();
    };
  }, [camera, editorToolsEnabled, gridSize, requestEditorRender, showAxes, showGrid, threeScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    setLoad({ status: 'loading' });

    const initialRenderSettings = useEngineSettings.getState();
    const game = new Game(resolvedAssetBaseUrl, {
      inputOptions: {
        gamepadDeadzone: 0.18,
        mouseOptions: { usePointerLock: true },
      },
      rendererOptions: {
        canvas,
        width: canvas.clientWidth || 800,
        height: canvas.clientHeight || 600,
        pixelRatio: getThreeNativePixelRatio(
          initialRenderSettings,
          typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        ),
        shadows: initialRenderSettings.shadows,
        shadowMapType: initialRenderSettings.shadowMapType,
        postProcessing: createThreeNativePostProcessingOptions(initialRenderSettings, false),
        beforeRender: ({ deltaTimeInSec, time }) => {
          if (!useRuntimeGameStore.getState().isPlaying) return;
          runtimeScriptTickRef.current?.({ deltaTimeInSec, time });
        },
      },
    });
    gameRef.current = game;

    (async () => {
      try {
        const fresh = projectDocument ?? await fetchPixlProject(resolvedAssetBaseUrl);
        // Merge autosaved edits ONTO the fresh sample (snapshot only ports
        // transform/visible/locked/name). See PhaserRuntimeMount / snapshotMerge.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshAny = fresh as any;
        const freshId = typeof freshAny?.id === 'string' ? freshAny.id : null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshSavedAt = typeof freshAny?.savedAt === 'number' ? freshAny.savedAt : 0;
        const snapshot = !projectDocument && freshId ? loadProjectDocSnapshot(freshId) : null;
        const useSnapshot = !!(snapshot
          && typeof snapshot.savedAt === 'number'
          && snapshot.savedAt > freshSavedAt);
        const project = useSnapshot && snapshot ? mergeSnapshotOntoFresh(fresh as any, snapshot) : fresh;
        if (disposed) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await game.loadFromPixlProject(project as any, initialScene);
        if (disposed) return;
        const scenes = (project as { scenes?: unknown[]; activeSceneId?: string }).scenes;
        const activeSceneId = (project as { activeSceneId?: string }).activeSceneId;
        const activeScene = Array.isArray(scenes)
          ? (scenes.find((scene) => (
            scene
            && typeof scene === 'object'
            && (scene as { id?: string }).id === activeSceneId
          )) ?? scenes[0])
          : null;
        const is3DScene = !!(
          activeScene
          && typeof activeScene === 'object'
          && (activeScene as { kind?: unknown }).kind === '3d'
        );

        if (is3DScene && activeScene && typeof activeScene === 'object') {
          try {
            await installThreeRuntimeScript({
              game,
              project,
              activeScene: activeScene as Record<string, unknown>,
              assetBaseUrl: resolvedAssetBaseUrl,
              canvas,
              setTick: (tick, disposeFn) => {
                runtimeScriptTickRef.current = tick;
                runtimeScriptDisposeRef.current?.();
                runtimeScriptDisposeRef.current = disposeFn ?? null;
              },
            });
          } catch (error) {
            console.error('[ThreeRuntimeMount] runtimeScript load failed:', error);
            runtimeScriptTickRef.current = null;
            runtimeScriptDisposeRef.current?.();
            runtimeScriptDisposeRef.current = null;
          }
        }
        // Activate OrbitControls now that the renderer has a camera.
        setCamera(game.renderer.threeJSCamera);
        setThreeScene(game.scene?.threeJSScene ?? null);
        // Aim the orbit target at the scene's camera target if present,
        // else fall back to scene origin.
        setOrbitTarget(getThreeCameraTarget(game.scene?.sceneJSONAsset?.data?.camera?.target));
        if (useRuntimeGameStore.getState().isPlaying || useRuntimeGameStore.getState().previewSession) {
          await game.play();
        } else {
          game.renderStillFrame();
        }
        setLoad({ status: 'ready' });
      } catch (error: unknown) {
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoad({ status: 'error', message });
      }
    })();

    return () => {
      disposed = true;
      try {
        runtimeScriptDisposeRef.current?.();
        runtimeScriptDisposeRef.current = null;
        runtimeScriptTickRef.current = null;
        gameRef.current?.dispose();
        gameRef.current = null;
      } catch {
        // ignore
      }
    };
  }, [initialScene, projectDocument, resolvedAssetBaseUrl]);

  return (
    <div
      data-runtime="three"
      data-three-mode={isRuntimePreview ? 'play' : 'edit'}
      data-three-simulation={runSimulation ? 'running' : 'paused'}
      data-three-editor-rendering={editorToolsEnabled && !runSimulation ? 'ondemand' : 'continuous'}
      data-three-postprocessing={nativePostProcessing.enabled ? 'filmic-realism' : 'off'}
      data-three-postprocessing-effects={nativePostProcessingEffects}
      data-three-sky={hasNativeSky ? 'procedural' : 'off'}
      style={{
        display: visible ? 'block' : 'none',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {editorToolsEnabled && showAxes && (
        <SceneOrientationGizmo camera={camera} activeView={sceneAxisView} onSnap={handleSceneAxisView} />
      )}
      <canvas
        ref={(node) => {
          canvasRef.current = node;
          setCanvasEl(node);
        }}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      />
      {load.status !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--editor-text, #cfd6e0)',
            fontSize: 14,
            background: 'rgba(8,8,8,0.55)',
            pointerEvents: 'none',
          }}
        >
          {load.status === 'loading' && 'Carregando projeto no @pixlland/three-runtime…'}
          {load.status === 'error' && (
            <span style={{ color: '#ff9b9b', textAlign: 'center', maxWidth: 480, padding: 16 }}>
              three-runtime: {load.message ?? 'falha ao carregar'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const ORIENTATION_GIZMO_SIZE = 96;
const ORIENTATION_AXIS_COLORS: Record<Exclude<SceneAxisView, 'free'>, string> = {
  x: '#d94b4b',
  y: '#55b96a',
  z: '#5c8fe8',
};
const ORIENTATION_AXIS_VECTORS: Record<Exclude<SceneAxisView, 'free'>, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const SceneOrientationGizmo = ({
  camera,
  activeView,
  onSnap,
}: {
  camera: THREE.PerspectiveCamera | null;
  activeView: SceneAxisView;
  onSnap: (axis: SceneAxisView) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelRefs = useRef<Record<'x' | 'y' | 'z', HTMLButtonElement | null>>({ x: null, y: null, z: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !camera) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(ORIENTATION_GIZMO_SIZE, ORIENTATION_GIZMO_SIZE, false);
    renderer.setClearColor(0x000000, 0);

    const gizmoScene = new THREE.Scene();
    const gizmoCamera = new THREE.OrthographicCamera(-1.25, 1.25, 1.25, -1.25, 0.01, 10);
    gizmoCamera.position.set(0, 0, 4);
    gizmoCamera.lookAt(0, 0, 0);

    const root = new THREE.Group();
    gizmoScene.add(root);

    const endpoints: THREE.Mesh[] = [];
    const endpointGeometry = new THREE.SphereGeometry(0.075, 24, 12);
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 24, 12),
      new THREE.MeshBasicMaterial({ color: '#f2f2f2' }),
    );
    root.add(center);

    (['x', 'y', 'z'] as const).forEach((axis) => {
      const vector = ORIENTATION_AXIS_VECTORS[axis];
      const color = ORIENTATION_AXIS_COLORS[axis];
      const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        vector.clone().multiplyScalar(0.78),
      ]);
      const line = new THREE.Line(lineGeometry, material);
      root.add(line);

      const endpoint = new THREE.Mesh(endpointGeometry, new THREE.MeshBasicMaterial({ color }));
      endpoint.position.copy(vector).multiplyScalar(0.92);
      endpoint.userData.axis = axis;
      root.add(endpoint);
      endpoints.push(endpoint);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const labelWorldPosition = new THREE.Vector3();
    const labelScreenPosition = new THREE.Vector3();
    let frame = 0;

    const updateLabels = () => {
      (['x', 'y', 'z'] as const).forEach((axis) => {
        const label = labelRefs.current[axis];
        if (!label) return;
        labelWorldPosition.copy(ORIENTATION_AXIS_VECTORS[axis]).multiplyScalar(1.08).applyQuaternion(root.quaternion);
        labelScreenPosition.copy(labelWorldPosition).project(gizmoCamera);
        const x = ((labelScreenPosition.x + 1) / 2) * ORIENTATION_GIZMO_SIZE;
        const y = ((-labelScreenPosition.y + 1) / 2) * ORIENTATION_GIZMO_SIZE;
        label.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
      });
    };

    const render = () => {
      root.quaternion.copy(camera.quaternion).invert();
      updateLabels();
      renderer.render(gizmoScene, gizmoCamera);
      frame = window.requestAnimationFrame(render);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, gizmoCamera);
      const hit = raycaster.intersectObjects(endpoints, false)[0];
      const axis = hit?.object.userData.axis;
      if (axis === 'x' || axis === 'y' || axis === 'z') {
        event.preventDefault();
        event.stopPropagation();
        onSnap(axis);
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      endpointGeometry.dispose();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh | THREE.Line;
        const geometry = (mesh as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        geometry?.dispose?.();
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose?.();
      });
      renderer.dispose();
    };
  }, [camera, onSnap]);

  return (
    <div
      data-scene-axis-view={activeView}
      className="absolute bottom-3 right-3 z-10 h-24 w-24"
    >
      <canvas ref={canvasRef} width={ORIENTATION_GIZMO_SIZE} height={ORIENTATION_GIZMO_SIZE} className="absolute inset-0 h-full w-full" />
      {(['x', 'y', 'z'] as const).map((axis) => (
        <AxisSnapButton
          key={axis}
          ref={(node) => { labelRefs.current[axis] = node; }}
          axis={axis}
          label={axis.toUpperCase()}
          active={activeView === axis}
          style={{ color: ORIENTATION_AXIS_COLORS[axis] }}
          onSnap={onSnap}
        />
      ))}
    <button
      type="button"
      title={sceneAxisLabels.free}
      aria-label={sceneAxisLabels.free}
      onClick={() => onSnap('free')}
        className={`absolute left-[42px] top-[42px] h-3 w-3 rounded-full border bg-[#f2f2f2]/90 shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition-colors hover:border-[#ffffff] ${activeView === 'free' ? 'border-[#ffffff]' : 'border-[#777777]'}`}
    />
  </div>
  );
};

const AxisSnapButton = React.forwardRef<HTMLButtonElement, {
  axis: SceneAxisView;
  label: string;
  active: boolean;
  style?: React.CSSProperties;
  onSnap: (axis: SceneAxisView) => void;
}>(({ axis, label, active, style, onSnap }, ref) => (
  <button
    ref={ref}
    type="button"
    title={sceneAxisLabels[axis]}
    aria-label={sceneAxisLabels[axis]}
    onClick={() => onSnap(axis)}
    style={style}
    className={`absolute left-0 top-0 flex h-5 w-5 items-center justify-center text-[10px] font-bold [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] transition-transform hover:scale-110 ${active ? 'drop-shadow-[0_0_4px_currentColor]' : ''}`}
  >
    {label}
  </button>
));
AxisSnapButton.displayName = 'AxisSnapButton';

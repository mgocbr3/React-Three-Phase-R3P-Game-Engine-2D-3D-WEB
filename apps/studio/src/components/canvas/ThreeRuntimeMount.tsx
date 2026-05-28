// Native Three.js editor/runtime mount.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Game, type RendererPostProcessingOptions } from '@pixlland/three-runtime';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { useEditorStore } from '@/stores/editorStore';
import { useEngineSettings, type EngineSettings } from '@/stores/engineSettingsStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { loadProjectDocSnapshot } from '@/services/projectDocStorage';
import { mergeSnapshotOntoFresh } from '@/services/snapshotMerge';
import { useOrbitControls } from './useOrbitControls';
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
type SceneAxisPose = { position: [number, number, number]; up: [number, number, number] };
type SceneViewShortcutInput = Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;
type ThreeEditorPlacementApi = { getAddObjectPosition: () => [number, number, number] | undefined };
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

const sceneViewShortcuts: Record<string, SceneAxisView> = {
  Digit1: 'z',
  Digit3: 'x',
  Digit5: 'free',
  Digit7: 'y',
  Numpad1: 'z',
  Numpad3: 'x',
  Numpad5: 'free',
  Numpad7: 'y',
};
const sceneAxisLabels: Record<SceneAxisView, string> = {
  x: 'Right View',
  y: 'Top View',
  z: 'Front View',
  free: 'Free View',
};
const sceneAxisShortcutLabels: Record<SceneAxisView, string> = {
  x: '3 / Numpad 3',
  y: '7 / Numpad 7',
  z: '1 / Numpad 1',
  free: '5 / Numpad 5',
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
  event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ? null : sceneViewShortcuts[event.code ?? ''] ?? null
);

const styleHelperMaterials = (object: THREE.Object3D, opacity: number): void => {
  const material = (object as THREE.LineSegments).material as THREE.Material | THREE.Material[] | undefined;
  const materials = Array.isArray(material) ? material : material ? [material] : [];
  materials.forEach((item) => {
    item.transparent = true;
    item.opacity = opacity;
    item.depthTest = false;
    item.depthWrite = false;
  });
};

const num = (value: number | undefined, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);
const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

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
): RendererPostProcessingOptions => ({
  enabled: true,
  toneMapping: settings.toneMapping,
  toneMappingExposure: num(settings.toneMappingExposure, 1.0),
  bloom: settings.bloom,
  bloomIntensity: clampNumber(num(settings.bloomIntensity, 0.18), 0, 0.25),
  bloomThreshold: clampNumber(num(settings.bloomThreshold, 0.9), 0.88, 1),
  bloomRadius: clampNumber(num(settings.bloomRadius, 0.24), 0, 0.35),
  colorGrading: true,
  brightness: settings.colorGrading ? num(settings.brightness, 0) : 0,
  contrast: settings.colorGrading ? num(settings.contrast, 0.04) : 0.04,
  saturation: settings.colorGrading ? num(settings.saturation, 0.02) : 0.02,
  hue: settings.colorGrading ? num(settings.hue, 0) : 0,
});

export const getThreeNativePostProcessingEffects = (
  options: RendererPostProcessingOptions,
): string => [
  options.toneMapping && options.toneMapping !== 'none' ? `tone:${options.toneMapping}` : null,
  options.bloom ? 'bloom' : null,
  options.colorGrading ? 'grade' : null,
].filter(Boolean).join(',');

const fetchPixlProject = async (baseUrl: string): Promise<unknown> => {
  const url = `${baseUrl.replace(/\/$/, '')}/project.pixlproject.json`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`project.pixlproject.json: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

type EditorObjectSummary = {
  id: string;
  name?: string;
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

export const getThreeEditorGridConfig = (gridSize: number) => {
  const size = Math.max(16, Math.min(500, Number.isFinite(gridSize) ? gridSize : 100));
  return { size, divisions: Math.max(16, Math.min(200, Math.round(size))) };
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
    const { size, divisions } = getThreeEditorGridConfig(gridSize);
    const grid = new THREE.GridHelper(size, divisions, '#c4cad1', '#6f7782');
    grid.name = 'Editor Grid';
    grid.position.y = 0.12;
    grid.renderOrder = 999;
    grid.userData = { ...HELPER_USER_DATA };
    styleHelperMaterials(grid, 0.82);
    root.add(grid);
  }

  if (showAxes) {
    const axes = new THREE.AxesHelper(Math.min(8, Math.max(3, gridSize * 0.05)));
    axes.name = 'Editor Axes';
    axes.position.y = 0.06;
    axes.renderOrder = 1000;
    axes.userData = { ...HELPER_USER_DATA };
    styleHelperMaterials(axes, 0.85);
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
    distance = Math.max(distance, size * 1.35, 6);
  } else {
    const elements = object.matrixWorld.elements;
    center.set(elements[12] ?? fallbackPosition[0], elements[13] ?? fallbackPosition[1], elements[14] ?? fallbackPosition[2]);
  }

  return { center, distance };
};

export function ThreeRuntimeMount({
  visible,
  assetBaseUrl = DEFAULT_BASE_URL,
  initialScene = DEFAULT_SCENE,
  gizmoMode = 'translate',
}: ThreeRuntimeMountProps): React.JSX.Element {
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
  const isRuntimePreview = useRuntimeGameStore((state) => state.isPlaying || Boolean(state.previewSession));
  const editorToolsEnabled = shouldEnableThreeEditorTools({ visible, isRuntimePreview });
  const requestEditorRender = useCallback(() => {
    if (!shouldRunThreeEditorRenderLoop({ visible, editorToolsEnabled, loadStatus: load.status })) return;
    if (editorRenderFrameRef.current) return;
    editorRenderFrameRef.current = requestAnimationFrame(() => {
      editorRenderFrameRef.current = 0;
      gameRef.current?.renderStillFrame();
    });
  }, [editorToolsEnabled, load.status, visible]);

  useOrbitControls({
    canvas: canvasEl,
    camera,
    target: orbitTarget,
    enabled: editorToolsEnabled,
    onReady: setOrbitControlsInstance,
    onChange: requestEditorRender,
  });

  // Three scene reference for raycasting; captured from game.scene.threeJSScene
  // when the load resolves.
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null);
  const showGrid = useEngineSettings((state) => state.showGrid);
  const showAxes = useEngineSettings((state) => state.showGizmo);
  const gridSize = useEngineSettings((state) => state.gridSize);
  const renderSettings = useEngineSettings();
  const nativePostProcessing = useMemo(
    () => createThreeNativePostProcessingOptions(renderSettings),
    [renderSettings],
  );
  const nativePostProcessingEffects = useMemo(
    () => getThreeNativePostProcessingEffects(nativePostProcessing),
    [nativePostProcessing],
  );

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
  useEffect(() => {
    setExternalSelectedThree(findThreeObjectForEditorSelection(
      threeScene,
      selectedObjectId,
      useEditorStore.getState().objects ?? [],
    ));
  }, [selectedObjectId, threeScene]);

  useEffect(() => {
    if (!focusTarget || !camera || !orbitControlsInstance) return;

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
    };
    runtime.__pixlThreeEditor = placementApi;
    return () => {
      if (runtime.__pixlThreeEditor === placementApi) delete runtime.__pixlThreeEditor;
    };
  }, [camera, editorToolsEnabled, orbitControlsInstance, orbitTarget]);

  const commitNativeGizmoTransform = useCallback((object: THREE.Object3D, transform: ThreeObjectTransform) => {
    const objectId = getPixlObjectIdFromThreeObject(object) ?? selectedObjectId;
    if (!objectId) return;
    const store = useEditorStore.getState();
    const current = store.objects.find((item) => item.id === objectId);
    if (!current || !hasThreeObjectTransformChanged(current, transform)) return;
    store.updateObject(objectId, transform);
    store.saveToHistory();
  }, [selectedObjectId]);

  const handleNativeSelectionChange = useCallback((object: THREE.Object3D | null) => {
    const objectId = getEditorObjectIdForNativeSelection(object);
    const store = useEditorStore.getState();
    if (store.selectedObjectId !== objectId) store.selectObject(objectId);
  }, []);

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
      const axis = getThreeSceneViewShortcut(event);
      if (!axis || isEditableSceneShortcutTarget(event.target)) return;
      event.preventDefault();
      handleSceneAxisView(axis);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorToolsEnabled, handleSceneAxisView]);

  useSelectionGizmo({
    canvas: canvasEl,
    camera,
    scene: threeScene,
    orbitControls: orbitControlsInstance,
    mode: effectiveGizmoMode,
    space: transformSpace,
    enabled: editorToolsEnabled,
    externalSelected: externalSelectedThree,
    onSelectionChange: handleNativeSelectionChange,
    onTransformCommit: commitNativeGizmoTransform,
    onChange: requestEditorRender,
    snapSettings: { snapEnabled, snapTranslate, snapRotate, snapScale },
  });

  const runSimulation = shouldRunThreeRuntimeSimulation({ visible, isRuntimePreview, loadStatus: load.status });

  useEffect(() => {
    const game = gameRef.current;
    if (!game || load.status !== 'ready') return;
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
    threeScene.add(helpers);
    requestEditorRender();
    return () => {
      threeScene.remove(helpers);
      helpers.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose?.());
        else material?.dispose?.();
      });
      requestEditorRender();
    };
  }, [editorToolsEnabled, gridSize, requestEditorRender, showAxes, showGrid, threeScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    setLoad({ status: 'loading' });

    const initialRenderSettings = useEngineSettings.getState();
    const game = new Game(assetBaseUrl, {
      rendererOptions: {
        canvas,
        width: canvas.clientWidth || 800,
        height: canvas.clientHeight || 600,
        pixelRatio: getThreeNativePixelRatio(
          initialRenderSettings,
          typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        ),
        postProcessing: createThreeNativePostProcessingOptions(initialRenderSettings),
      },
    });
    gameRef.current = game;

    (async () => {
      try {
        const fresh = await fetchPixlProject(assetBaseUrl);
        // Merge autosaved edits ONTO the fresh sample (snapshot only ports
        // transform/visible/locked/name). See PhaserRuntimeMount / snapshotMerge.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshAny = fresh as any;
        const freshId = typeof freshAny?.id === 'string' ? freshAny.id : null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshSavedAt = typeof freshAny?.savedAt === 'number' ? freshAny.savedAt : 0;
        const snapshot = freshId ? loadProjectDocSnapshot(freshId) : null;
        const useSnapshot = !!(snapshot
          && typeof snapshot.savedAt === 'number'
          && snapshot.savedAt > freshSavedAt);
        const project = useSnapshot && snapshot ? mergeSnapshotOntoFresh(fresh as any, snapshot) : fresh;
        if (disposed) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await game.loadFromPixlProject(project as any, initialScene);
        if (disposed) return;
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
        gameRef.current?.dispose();
        gameRef.current = null;
      } catch {
        // ignore
      }
    };
  }, [assetBaseUrl, initialScene]);

  return (
    <div
      data-runtime="three"
      data-three-mode={isRuntimePreview ? 'play' : 'edit'}
      data-three-simulation={runSimulation ? 'running' : 'paused'}
      data-three-editor-rendering={editorToolsEnabled && !runSimulation ? 'ondemand' : 'continuous'}
      data-three-postprocessing={nativePostProcessing.enabled ? 'filmic-realism' : 'off'}
      data-three-postprocessing-effects={nativePostProcessingEffects}
      style={{
        display: visible ? 'block' : 'none',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {editorToolsEnabled && showAxes && <SceneAxesWidget activeView={sceneAxisView} onSnap={handleSceneAxisView} />}
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

const SceneAxesWidget = ({ activeView, onSnap }: { activeView: SceneAxisView; onSnap: (axis: SceneAxisView) => void }) => (
  <div data-scene-axis-view={activeView} className="pointer-events-none absolute right-3 top-3 z-10 h-20 w-20 text-[10px] font-bold text-[#c9c9c9]">
    <div className="absolute left-1/2 top-1/2 h-px w-9 origin-left bg-[#d94b4b]" style={{ transform: 'rotate(-18deg)' }} />
    <div className="absolute left-1/2 top-1/2 h-px w-8 origin-left bg-[#55b96a]" style={{ transform: 'rotate(-96deg)' }} />
    <div className="absolute left-1/2 top-1/2 h-px w-8 origin-left bg-[#5c8fe8]" style={{ transform: 'rotate(42deg)' }} />
    <AxisSnapButton axis="x" label="X" active={activeView === 'x'} className="right-0 top-[24px] text-[#d94b4b]" onSnap={onSnap} />
    <AxisSnapButton axis="y" label="Y" active={activeView === 'y'} className="left-[31px] top-0 text-[#55b96a]" onSnap={onSnap} />
    <AxisSnapButton axis="z" label="Z" active={activeView === 'z'} className="right-2 bottom-1 text-[#5c8fe8]" onSnap={onSnap} />
    <button
      type="button"
      title={`${sceneAxisLabels.free} (${sceneAxisShortcutLabels.free})`}
      aria-label={sceneAxisLabels.free}
      onClick={() => onSnap('free')}
      className={`pointer-events-auto absolute left-[33px] top-[33px] h-3 w-3 border bg-[#1f1f1f] transition-colors hover:border-[#dddddd] ${activeView === 'free' ? 'border-[#e0e0e0]' : 'border-[#a8a8a8]'}`}
    />
  </div>
);

const AxisSnapButton = ({
  axis,
  label,
  active,
  className,
  onSnap,
}: {
  axis: SceneAxisView;
  label: string;
  active: boolean;
  className: string;
  onSnap: (axis: SceneAxisView) => void;
}) => (
  <button
    type="button"
    title={`${sceneAxisLabels[axis]} (${sceneAxisShortcutLabels[axis]})`}
    aria-label={sceneAxisLabels[axis]}
    onClick={() => onSnap(axis)}
    className={`pointer-events-auto absolute flex h-5 w-5 items-center justify-center transition-colors hover:text-foreground ${active ? 'drop-shadow-[0_0_4px_currentColor]' : ''} ${className}`}
  >
    {label}
  </button>
);

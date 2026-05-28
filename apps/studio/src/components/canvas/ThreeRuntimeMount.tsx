// GDD §6.6 — Phase 6B in progress.
// 3D mount that owns one <canvas>, instantiates @pixlland/three-runtime's
// Game, and bridges engine-api WS broadcasts so non-editor agents (CLI,
// MCP, HTTP) hot-reload the studio view in <500 ms.
//
// Loading flow (Phase 6B):
//   1. fetch `${assetBaseUrl}/project.pixlproject.json` (Pixl format on disk)
//   2. game.loadFromPixlProject(doc) — adapter converts Pixl → Wes GameJSON
//      in memory, primes the asset cache, runs Scene.load() normally
//   3. GLB / textures / audio resolved by the runtime's AssetSource off
//      `${assetBaseUrl}` as usual
//
// What this component *does not* try to replicate from the legacy R3F
// editor (intentional — see GDD §0 and §6.6):
//   - Built-in gameplay controllers (FPSController, VehicleController…)
//   - Built-in templates (Minecraft, racing, platformer)
//   - PostProcessing effects, AdaptivePerformance, AutoInstancer
//
// Per GDD §7, gameplay belongs in agent-written scripts that the runtime
// hot-loads, NOT in the engine's React tree.

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Game } from '@pixlland/three-runtime';
import * as THREE from 'three';

import { useEditorStore } from '@/stores/editorStore';
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
  /** Transform gizmo mode. Phase 6B step 4. */
  gizmoMode?: GizmoMode;
}

interface LoadState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
}

const DEFAULT_BASE_URL = '/sample-projects/harvest-rush-3d';
const DEFAULT_SCENE: string | undefined = undefined; // let project.activeSceneId pick

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
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  // Captured once the runtime's renderer is constructed. The orbit
  // controls hook activates when both fields are set.
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [orbitTarget, setOrbitTarget] = useState<{ x: number; y: number; z: number } | undefined>(undefined);
  const isRuntimePreview = useRuntimeGameStore((state) => state.isPlaying || Boolean(state.previewSession));
  const editorToolsEnabled = shouldEnableThreeEditorTools({ visible, isRuntimePreview });

  useOrbitControls({
    canvas: canvasEl,
    camera,
    target: orbitTarget,
    enabled: editorToolsEnabled,
  });

  // The OrbitControls instance is captured via the global hook side-effect
  // so the gizmo can suspend it during drag. Phase 6B step final: thread
  // this through a proper handle instead of the global.
  const [orbitControlsInstance, setOrbitControlsInstance] = useState<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any | null
  >(null);
  useEffect(() => {
    if (!camera || !canvasEl) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOrbitControlsInstance((window as any).__pixlOrbitControls ?? null);
  }, [camera, canvasEl]);

  // Three scene reference for raycasting; captured from game.scene.threeJSScene
  // when the load resolves.
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null);

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
  }, [camera, externalSelectedThree, focusTarget, orbitControlsInstance, selectedObjectId, threeScene]);

  const commitNativeGizmoTransform = useCallback((object: THREE.Object3D, transform: ThreeObjectTransform) => {
    const objectId = getPixlObjectIdFromThreeObject(object) ?? selectedObjectId;
    if (!objectId) return;
    const store = useEditorStore.getState();
    const current = store.objects.find((item) => item.id === objectId);
    if (!current || !hasThreeObjectTransformChanged(current, transform)) return;
    store.updateObject(objectId, transform);
    store.saveToHistory();
  }, [selectedObjectId]);

  useSelectionGizmo({
    canvas: canvasEl,
    camera,
    scene: threeScene,
    orbitControls: orbitControlsInstance,
    mode: effectiveGizmoMode,
    space: transformSpace,
    enabled: editorToolsEnabled,
    externalSelected: externalSelectedThree,
    onTransformCommit: commitNativeGizmoTransform,
    snapSettings: { snapEnabled, snapTranslate, snapRotate, snapScale },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    setLoad({ status: 'loading' });

    const game = new Game(assetBaseUrl, {
      rendererOptions: { canvas, width: canvas.clientWidth || 800, height: canvas.clientHeight || 600 },
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
        game.play();
        // Phase 6B debug — expose game instance for inspection. Strip later.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__pixlGame = game;
        // Activate OrbitControls now that the renderer has a camera.
        setCamera(game.renderer.threeJSCamera);
        setThreeScene(game.scene?.threeJSScene ?? null);
        // Aim the orbit target at the scene's camera target if present,
        // else fall back to scene origin.
        const sceneTarget = game.scene?.sceneJSONAsset?.data?.camera?.target;
        if (sceneTarget) {
          setOrbitTarget({
            x: sceneTarget.x ?? 0,
            y: sceneTarget.y ?? 0,
            z: sceneTarget.z ?? 0,
          });
        } else {
          setOrbitTarget({ x: 0, y: 0, z: 0 });
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
        gameRef.current?.pause();
        gameRef.current = null;
      } catch {
        // ignore
      }
    };
  }, [assetBaseUrl, initialScene]);

  return (
    <div
      data-runtime="three"
      style={{
        display: visible ? 'block' : 'none',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
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

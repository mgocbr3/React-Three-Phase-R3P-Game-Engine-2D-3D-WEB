import React, { Suspense, useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { 
  Grid, 
} from '@react-three/drei';
import * as THREE from 'three';
import { RapierRigidBody } from '@react-three/rapier';
import { SceneObject, useEditorStore } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useAssetDragStore } from '@/stores/assetDragStore';
import { useThreeMemoryMonitor } from '@/hooks/useThreeCleanup';
import { EditableObject } from './EditableObject';
import { GizmoInteractionLock, TransformGizmo } from './TransformGizmo';
import { DefaultPlayer } from './primitives/DefaultPlayer';
import { FPSController } from './controllers/FPSController';
import { PlatformerController } from './controllers/PlatformerController';
import { FlyCamera } from './FlyCamera';
import { GameCamera } from './GameCamera';
import { ScriptRunner } from './ScriptRunner';
import { PostProcessingEffects } from './PostProcessingEffects';
import { SceneFog } from './SceneFog';
import { AudioListener as AudioListenerComponent } from './AudioListener';
import { AdaptivePerformance } from './AdaptivePerformance';
import { AutoInstancer } from './AutoInstancer';
import {
  StaticGltfScene,
  getStaticGltfObjectByEditorId,
  getStaticGltfObjectWorldTransform,
  hasStaticGltfScene,
  pickStaticGltfNodes,
} from './StaticGltfScene';
import type { StaticGltfEditorObject } from './StaticGltfScene';
import { WebGLContextRecovery } from './WebGLContextRecovery';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { AtmosphericLighting } from './AtmosphericLighting';
import { Skybox } from './primitives/Skybox';
import { ActiveTerrain } from '@/components/terrain/ActiveTerrain';
import { useTerrainStore } from '@/stores/terrainStore';
import { toast } from 'sonner';
import { PhaserViewport2D } from './PhaserViewport2D';
import { useViewportStore } from '@/stores/viewportStore';

const LARGE_EDIT_SCENE_OBJECT_THRESHOLD = 2500;
const DECOMPOSED_GLTF_STATIC_PART_THRESHOLD = 100;
const PICK_FALLBACK_MOVE_THRESHOLD_PX = 10;
const staticTransformPosition = new THREE.Vector3();
const staticTransformRotation = new THREE.Euler();
const staticTransformScale = new THREE.Vector3();
const canvasPickRaycaster = new THREE.Raycaster();
const canvasPickPointer = new THREE.Vector2();

const getObjectPickNodeName = (object: SceneObject) => {
  const customData = object.logicSettings?.customData ?? {};
  const sourceNodeName = customData.sourceNodeName;
  if (typeof sourceNodeName === 'string') return sourceNodeName;
  return object.animationSettings?.nodeName;
};

const getObjectPickNodeIndex = (object: SceneObject) => {
  const nodeIndex = object.logicSettings?.customData?.sourceNodeIndex;
  return typeof nodeIndex === 'number' && Number.isInteger(nodeIndex) ? nodeIndex : undefined;
};

const getObjectPickModelUrl = (object: SceneObject) => (
  object.animationSettings?.modelUrl
);

const getObjectSourceSceneScale = (object: SceneObject) => {
  const customData = object.logicSettings?.customData ?? {};
  const sourceScale = customData.sourceScale ?? customData.sceneScale;
  if (typeof sourceScale !== 'number' || !Number.isFinite(sourceScale) || sourceScale <= 0) {
    return null;
  }
  return sourceScale;
};

const isEditableGltfPartObject = (object: SceneObject) => (
  Boolean(object.logicSettings?.customData?.editableGlbPart && object.animationSettings?.modelUrl)
);

const getObjectSelectionRole = (object: SceneObject) => {
  const customData = object.logicSettings?.customData ?? {};
  const role = customData.editorSelectionRole ?? customData.selectionRole;
  return typeof role === 'string' ? role : 'default';
};

const isBackgroundSelectionRole = (role: string | undefined, type: string | undefined) => (
  role === 'surface' ||
  role === 'background' ||
  type === 'plane' ||
  type === 'platform'
);

// Editor-time scene lighting. Neutral fill + the UE4 sky GLB so the
// designer sees the same horizon their players will see at runtime.
// The Suspense fallback paints a flat sky-ish blue (matches the avg
// of the GLB texture) so we don't flash grey while the GLB streams in
// — but we deliberately skip `<color attach="background">` because
// it competes with the skydome and wins on a noticeable percentage of
// frames during R3F's reconciliation, leaving a grey halo around the
// skydome edges.
const MavonEditorLighting = () => (
  <>
    <Suspense fallback={<color attach="background" args={['#a4bdd2']} />}>
      <Skybox />
    </Suspense>
    <ambientLight color="#ffffff" intensity={0.35} />
    <hemisphereLight color="#aaaaaa" groundColor="#3a3a3a" intensity={0.45} />
  </>
);

const EditorSelectionFallback = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  const { camera, gl, scene } = useThree();
  const selectObject = useEditorStore((state) => state.selectObject);
  const pointerDownRef = useRef<{
    x: number;
    y: number;
    selectedId: string | null;
    startedOnTransformControl: boolean;
  } | null>(null);

  const pointerHitsTransformControl = useCallback((clientX: number, clientY: number) => {
    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return GizmoInteractionLock.isActive();

    canvasPickPointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );

    return GizmoInteractionLock.isActive() || GizmoInteractionLock.raycastGizmo(canvasPickPointer);
  }, [gl]);

  const findFallbackPick = useCallback((clientX: number, clientY: number) => {
    const canvas = gl.domElement;
    const objects = useEditorStore.getState().objects;
    const objectsById = new Map(objects.map((object) => [object.id, object]));
    const rect = canvas.getBoundingClientRect();

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return null;
    }

    canvasPickPointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    canvasPickRaycaster.setFromCamera(canvasPickPointer, camera);

    const staticSceneUrls = new Set(
      objects
        .map((object) => object.animationSettings?.modelUrl)
        .filter((url): url is string => Boolean(url && hasStaticGltfScene(url))),
    );
    const pickCandidates: { id: string; role: string; type: string; distance: number }[] = [];
    pickStaticGltfNodes(staticSceneUrls, camera, canvas, clientX, clientY).forEach((staticHit) => {
      const pickedObject = objectsById.get(staticHit.objectId);
      if (!pickedObject || pickedObject.visible === false || pickedObject.locked) return;
      pickCandidates.push({
        id: pickedObject.id,
        role: getObjectSelectionRole(pickedObject),
        type: pickedObject.type,
        distance: staticHit.distance,
      });
    });

    const pickableSceneChildren = scene.children.filter((child) => !child.userData?.isStaticGltfVisualRoot);
    const hits = canvasPickRaycaster.intersectObjects(pickableSceneChildren, true);
    const seen = new Set<string>();

    for (const hit of hits) {
      let current: THREE.Object3D | null = hit.object;
      while (current) {
        if (current.userData?.isEditorInternal) break;

        const objectId = current.userData?.objectId ?? current.userData?.editorObjectId;
        if (typeof objectId === 'string' && !seen.has(objectId)) {
          seen.add(objectId);
          const object = objectsById.get(objectId);
          if (!object || object.visible === false || object.locked) break;

          const role = current.userData?.objectSelectionRole ?? getObjectSelectionRole(object);
          const type = current.userData?.objectType ?? object.type;
          pickCandidates.push({ id: objectId, role, type, distance: hit.distance });

          break;
        }

        current = current.parent;
      }
    }

    pickCandidates.sort((a, b) => a.distance - b.distance);
    return pickCandidates.find((pick) => !isBackgroundSelectionRole(pick.role, pick.type))?.id
      ?? pickCandidates[0]?.id
      ?? null;
  }, [camera, gl, scene]);

  useEffect(() => {
    if (!enabled) return;

    const canvas = gl.domElement;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) {
        pointerDownRef.current = null;
        return;
      }

      pointerDownRef.current = {
        x: event.clientX,
        y: event.clientY,
        selectedId: useEditorStore.getState().selectedObjectId,
        startedOnTransformControl: pointerHitsTransformControl(event.clientX, event.clientY),
      };
    };

    const handlePointerUp = (event: PointerEvent) => {
      const pointerDown = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!pointerDown || event.button !== 0) return;

      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      if ((dx * dx) + (dy * dy) > PICK_FALLBACK_MOVE_THRESHOLD_PX * PICK_FALLBACK_MOVE_THRESHOLD_PX) return;

      window.setTimeout(() => {
        const state = useEditorStore.getState();
        if (!state.isEditMode || pointerDown.startedOnTransformControl || pointerHitsTransformControl(event.clientX, event.clientY)) {
          return;
        }

        const pickedId = findFallbackPick(event.clientX, event.clientY);
        if (pickedId) {
          selectObject(pickedId);
        } else if (state.selectedObjectId === pointerDown.selectedId && state.selectedObjectId) {
          selectObject(null);
        }
      }, 0);
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true });
    canvas.addEventListener('pointerup', handlePointerUp, { capture: true });

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      canvas.removeEventListener('pointerup', handlePointerUp, { capture: true });
    };
  }, [enabled, findFallbackPick, gl, pointerHitsTransformControl, selectObject]);

  return null;
};

const StaticGltfSelectionHelper = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  const { scene } = useThree();
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const target = enabled ? getStaticGltfObjectByEditorId(selectedObjectId) : null;
  const helperRef = useRef<THREE.BoxHelper | null>(null);

  useEffect(() => {
    if (!target) return;

    const helper = new THREE.BoxHelper(target, 0xff8c00);
    helper.userData = {
      ...helper.userData,
      isEditorInternal: true,
    };
    helper.raycast = () => null;
    helperRef.current = helper;
    scene.add(helper);

    return () => {
      scene.remove(helper);
      helper.geometry.dispose();
      helperRef.current = null;
    };
  }, [scene, target]);

  useFrame(() => {
    helperRef.current?.update();
  });

  return null;
};

const StaticGltfTransformBridge = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectedObject = useEditorStore((state) => (
    state.selectedObjectId ? state.objects.find((object) => object.id === state.selectedObjectId) ?? null : null
  ));
  const transformMode = useEditorStore((state) => state.transformMode);
  const transformSpace = useEditorStore((state) => state.transformSpace);
  const updateObject = useEditorStore((state) => state.updateObject);
  const saveToHistory = useEditorStore((state) => state.saveToHistory);
  const targetRef = useRef<THREE.Object3D>(null!);
  const target = enabled ? getStaticGltfObjectByEditorId(selectedObjectId) : null;

  if (target) {
    targetRef.current = target;
  }

  const handleTransformEnd = useCallback(() => {
    GizmoInteractionLock.endDrag();
    GizmoInteractionLock.unlock();

    if (!selectedObject) return;
    if (!getStaticGltfObjectWorldTransform(
      selectedObject.id,
      staticTransformPosition,
      staticTransformRotation,
      staticTransformScale,
    )) {
      return;
    }

    updateObject(selectedObject.id, {
      position: staticTransformPosition.toArray() as [number, number, number],
      rotation: [
        staticTransformRotation.x,
        staticTransformRotation.y,
        staticTransformRotation.z,
      ],
      scale: staticTransformScale.toArray() as [number, number, number],
    });
    saveToHistory();
  }, [saveToHistory, selectedObject, updateObject]);

  if (!enabled || !selectedObject || !target || transformMode === 'select') {
    return null;
  }

  return (
    <TransformGizmo
      key={selectedObject.id}
      targetRef={targetRef}
      mode={transformMode as 'translate' | 'rotate' | 'scale'}
      space={transformSpace}
      onTransformEnd={handleTransformEnd}
    />
  );
};

const EditorScene = () => {
  const objects = useEditorStore((state) => state.objects);
  const isEditMode = useEditorStore((state) => state.isEditMode);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const engineSettings = useEngineSettings();
  const { terrainSettings, isTerrainActive } = useTerrainStore();
  const playerRef = useRef<THREE.Object3D>(null!);
  const rigidBodies = useRef<Map<string, RapierRigidBody>>(new Map());
  const groups = useRef<Map<string, THREE.Group>>(new Map());
  const isLargeEditScene = isEditMode && objects.length >= LARGE_EDIT_SCENE_OBJECT_THRESHOLD;
  const staticGltfSceneUrls = useMemo(() => {
    if (!isLargeEditScene) return [];

    const sceneInfoByUrl = new Map<string, { count: number; sceneScale: number }>();
    objects.forEach((object) => {
      if (!isEditableGltfPartObject(object)) return;

      const modelUrl = object.animationSettings?.modelUrl;
      if (!modelUrl) return;

      const current = sceneInfoByUrl.get(modelUrl);
      sceneInfoByUrl.set(modelUrl, {
        count: (current?.count ?? 0) + 1,
        sceneScale: current?.sceneScale ?? getObjectSourceSceneScale(object) ?? 1,
      });
    });

    return Array.from(sceneInfoByUrl.entries())
      .filter(([, info]) => info.count >= DECOMPOSED_GLTF_STATIC_PART_THRESHOLD)
      .map(([url, info]) => ({ url, sceneScale: info.sceneScale }));
  }, [isLargeEditScene, objects]);
  const staticGltfSceneUrlSet = useMemo(() => new Set(staticGltfSceneUrls.map((scene) => scene.url)), [staticGltfSceneUrls]);
  const useStaticGltfScene = staticGltfSceneUrls.length > 0;
  const staticGltfEditorObjectsByUrl = useMemo(() => {
    const grouped = new Map<string, StaticGltfEditorObject[]>();
    if (!useStaticGltfScene) return grouped;

    objects.forEach((object) => {
      if (!isEditableGltfPartObject(object)) return;

      const modelUrl = object.animationSettings?.modelUrl;
      const nodeName = getObjectPickNodeName(object);
      if (!modelUrl || !nodeName || !staticGltfSceneUrlSet.has(modelUrl)) return;

      const items = grouped.get(modelUrl) ?? [];
      items.push({
        id: object.id,
        type: object.type,
        nodeName,
        nodeIndex: getObjectPickNodeIndex(object),
        position: object.position,
        rotation: object.rotation,
        scale: object.scale,
        visible: object.visible,
        locked: object.locked,
        selectionRole: getObjectSelectionRole(object),
      });
      grouped.set(modelUrl, items);
    });

    return grouped;
  }, [objects, staticGltfSceneUrlSet, useStaticGltfScene]);
  const renderedObjects = useMemo(() => {
    if (!useStaticGltfScene) {
      return objects.filter((object) => object.visible !== false);
    }

    return objects.filter((object) => {
      if (object.visible === false) return false;
      if (!isEditableGltfPartObject(object)) return true;
      const modelUrl = object.animationSettings?.modelUrl;
      if (!modelUrl || !staticGltfSceneUrlSet.has(modelUrl)) return true;
      return false;
    });
  }, [objects, staticGltfSceneUrlSet, useStaticGltfScene]);
  
  // Three.js memory monitoring
  const { gl } = useThree();
  useThreeMemoryMonitor(gl, 60); // Log memory stats every 60 seconds
  
  const cameraObject = useMemo(() => objects.find((object) => object.type === 'camera'), [objects]);
  const playerObject = useMemo(() => objects.find((object) => object.type === 'player'), [objects]);
  const cameraSettings = cameraObject?.cameraSettings;
  const playerSettings = playerObject?.playerSettings;
  
  // Adjust player spawn height when terrain is active
  const basePlayerPosition = playerObject?.position || [0, 1.5, 0];
  const playerPosition: [number, number, number] = isTerrainActive && terrainSettings
    ? [basePlayerPosition[0], terrainSettings.height + 5, basePlayerPosition[2]]
    : basePlayerPosition as [number, number, number];
  
  const playerColor = playerObject?.color || '#6366f1';
  
  // Check if camera has a valid target
  const targetId = cameraSettings?.targetId;
  const hasValidTarget = targetId && (targetId === 'main-player' || objects.some(obj => obj.id === targetId));

  return (
    <>
      {isEditMode && <FlyCamera speed={15} fastSpeed={40} lookSpeed={0.003} />}
      
      {/* Game Camera - Only in Play Mode when NOT using third-person or side-2d controllers 
          (those controllers have their own camera logic) */}
      {!isEditMode && cameraSettings && hasValidTarget && 
       cameraSettings.mode !== 'third-person' && 
       cameraSettings.mode !== 'side-2d' && (
        <GameCamera 
          key={`camera-${cameraSettings.mode}-${cameraSettings.distance}-${cameraSettings.height}`}
          settings={cameraSettings} 
          targetRef={playerRef} 
        />
      )}

      {/* Grid - Controlled by engine settings, only in Edit Mode */}
      {engineSettings.showGrid && isEditMode && (
        <Grid
          args={[engineSettings.gridSize, engineSettings.gridSize]}
          cellSize={1}
          cellThickness={0.18}
          cellColor="#3a3a5a"
          sectionSize={5}
          sectionThickness={0.3}
          sectionColor="#5a5a8a"
          fadeDistance={300}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
          position={[0, 0.05, 0]}
        />
      )}

      {/* Fog - Controlled by engine settings */}
      <SceneFog />

      {/* Scene Objects */}
      <Suspense fallback={null}>
        <Physics paused={isEditMode} gravity={[0, -(playerSettings?.gravity || 20), 0]}>
          {/* Procedural Terrain - if active */}
          <ActiveTerrain />

          {isEditMode && staticGltfSceneUrls.map(({ url, sceneScale }) => (
            <StaticGltfScene
              key={url}
              url={url}
              sceneScale={sceneScale}
              editorObjects={staticGltfEditorObjectsByUrl.get(url)}
              selectedObjectId={selectedObjectId}
            />
          ))}
          
          {/* Render ALL editable objects from the store */}
          {/* This includes NPCs, trees, houses, platforms, etc. that appear in the hierarchy */}
          {renderedObjects.map((obj) => (
            <EditableObject
              key={obj.id}
              object={obj}
              rigidBodies={rigidBodies}
              groups={groups}
            />
          ))}
          
          {/* Player - only in play mode, controller chosen by camera mode */}
          {!isEditMode && cameraSettings?.mode === 'first-person' ? (
            <FPSController 
              ref={playerRef}
              position={playerPosition as [number, number, number]} 
              playerSettings={playerSettings}
            />
          ) : !isEditMode && cameraSettings?.mode === 'side-2d' ? (
            <PlatformerController 
              ref={playerRef}
              position={playerPosition as [number, number, number]} 
              color={playerColor}
              playerSettings={playerSettings}
            />
          ) : !isEditMode && (
            <DefaultPlayer
              ref={playerRef}
              position={playerPosition as [number, number, number]}
              modelUrl={playerObject?.animationSettings?.modelUrl ?? '/models/manequin/scene.gltf'}
              playerSettings={playerSettings}
              cameraSettings={cameraSettings}
            />
          )}
          
          {/* Script Executor - runs scripts in Play Mode */}
          <ScriptRunner rigidBodies={rigidBodies} groups={groups} />
          
          {/* Auto-Instancing for performance */}
          <AutoInstancer />
        </Physics>
      </Suspense>

      <StaticGltfSelectionHelper
        enabled={isEditMode && useStaticGltfScene}
      />

      <StaticGltfTransformBridge
        enabled={isEditMode && useStaticGltfScene}
      />

      <EditorSelectionFallback
        enabled={isEditMode}
      />
      
      {/* Adaptive Performance Monitor */}
      <AdaptivePerformance 
        enabled={engineSettings.autoQuality && !isEditMode && !isLargeEditScene}
      />

      {/* Mavon-style editor path: keep the edit viewport direct and cheap. */}
      {isEditMode ? <MavonEditorLighting /> : <AtmosphericLighting />}

      {/* Post-processing belongs to game preview, not editor transforms. */}
      {!isEditMode && <PostProcessingEffects />}

      {/* WebGL Context Recovery Monitor */}
      <WebGLContextRecovery 
        onContextLost={() => console.warn('[EditorCanvas] WebGL context lost - recovery pending')}
        onContextRestored={() => console.info('[EditorCanvas] WebGL context restored')}
      />

      {/* Stats panel removed - now integrated into status bar */}
    </>
  );
};

// Map settings to THREE constants
const getToneMappingType = (type: string) => {
  switch (type) {
    case 'aces': return THREE.ACESFilmicToneMapping;
    case 'cineon': return THREE.CineonToneMapping;
    case 'reinhard': return THREE.ReinhardToneMapping;
    case 'linear': return THREE.LinearToneMapping;
    case 'none': return THREE.NoToneMapping;
    default: return THREE.ACESFilmicToneMapping;
  }
};

const getShadowMapType = (type: string) => {
  switch (type) {
    case 'basic': return THREE.BasicShadowMap;
    case 'percentage': return THREE.PCFShadowMap;
    case 'soft': return THREE.PCFSoftShadowMap;
    case 'variance': return THREE.VSMShadowMap;
    default: return THREE.PCFSoftShadowMap;
  }
};

export const EditorCanvas = () => {
  const engineSettings = useEngineSettings();
  const viewportMode = useViewportStore((state) => state.viewportMode);
  const selectObject = useEditorStore((state) => state.selectObject);
  const isEditMode = useEditorStore((state) => state.isEditMode);
  const addModelFromAsset = useEditorStore((state) => state.addModelFromAsset);
  const objectCount = useEditorStore((state) => state.objects.length);
  const { isDragging, endDrag } = useAssetDragStore();
  const [canvasKey, setCanvasKey] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Force remount on error recovery
  const handleCanvasReset = useCallback(() => {
    setCanvasKey(prev => prev + 1);
  }, []);
  
  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);
  
  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  
  // Handle drop - add asset to scene
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    endDrag();
    
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      
      const assetData = JSON.parse(data);
      if (assetData.type !== 'pixlland-asset') return;
      
      // Calculate drop position based on mouse position in canvas
      // For now, we'll place it at origin. A more advanced implementation 
      // would raycast to the ground plane
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const z = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Simple mapping to world coordinates (approximate)
        const worldX = x * 10;
        const worldZ = z * 10;
        
        addModelFromAsset({
          name: assetData.name,
          url: assetData.url,
          type: assetData.assetType,
          thumbnailUrl: assetData.thumbnailUrl
        }, [worldX, 0, worldZ]);
        
        toast.success(`${assetData.name} adicionado à cena!`);
      }
    } catch (err) {
      console.error('[EditorCanvas] Failed to parse drop data:', err);
    }
  }, [addModelFromAsset, endDrag]);
  
  // Handle click on empty space to deselect - ONLY in Select mode
  const handlePointerMissed = useCallback(() => {
    if (!isEditMode) return;
    if (objectCount >= LARGE_EDIT_SCENE_OBJECT_THRESHOLD) return;
    if (GizmoInteractionLock.isActive()) return;
    const { transformMode } = useEditorStore.getState();
    if (transformMode !== 'select') return;
    selectObject(null);
  }, [isEditMode, objectCount, selectObject]);
  
  const toneMappingExposure = Math.min(engineSettings.toneMappingExposure, 0.9);

  // Advanced GL config for better performance
  const glConfig = useMemo(() => ({
    antialias: engineSettings.antialias,
    toneMapping: getToneMappingType(engineSettings.toneMapping),
    toneMappingExposure: toneMappingExposure,
    outputColorSpace: engineSettings.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace,
    // Performance optimizations
    powerPreference: 'high-performance' as const,
    stencil: false,
    depth: true,
    alpha: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
    // Reduce memory usage
    precision: 'highp' as const,
    logarithmicDepthBuffer: false,
  }), [engineSettings.antialias, engineSettings.toneMapping, toneMappingExposure, engineSettings.colorSpace]);

  const disableEditorRealtimeShadows = isEditMode && objectCount >= LARGE_EDIT_SCENE_OBJECT_THRESHOLD;

  // Calculate optimal DPR based on device. The editor keeps a stable crisp floor so
  // auto-quality presets cannot leave the viewport blurry after heavy scene transitions.
  const optimalDpr = useMemo(() => {
    const maxDpr = isEditMode ? Math.max(1.25, engineSettings.maxDpr) : engineSettings.maxDpr;
    const dprFloor = Math.min(isEditMode ? Math.max(1, engineSettings.dpr) : Math.max(0.5, engineSettings.dpr), maxDpr);
    const deviceDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    return [dprFloor, Math.max(dprFloor, Math.min(deviceDpr, maxDpr))] as [number, number];
  }, [engineSettings.dpr, engineSettings.maxDpr, isEditMode]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/20 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-card/90 backdrop-blur-sm px-6 py-4 rounded-lg shadow-xl text-center">
            <div className="text-4xl mb-2"></div>
            <p className="text-lg font-semibold text-foreground">Solte para adicionar à cena</p>
            <p className="text-sm text-muted-foreground">O asset será posicionado no local do drop</p>
          </div>
        </div>
      )}

      {viewportMode === '2d' ? (
        <PhaserViewport2D />
      ) : (
        <CanvasErrorBoundary onReset={handleCanvasReset}>
          <Canvas
            key={canvasKey}
            shadows={engineSettings.shadows && !disableEditorRealtimeShadows ? { type: getShadowMapType(engineSettings.shadowMapType) } : false}
            camera={{ position: [10, 10, 10], fov: 50 }}
            gl={glConfig}
            dpr={optimalDpr}
            frameloop={engineSettings.frameloop}
            performance={{ min: 0.5, max: 1, debounce: 200 }}
            onPointerMissed={handlePointerMissed}
            onCreated={({ gl }) => {
              // Additional WebGL optimizations
              gl.setPixelRatio(optimalDpr[0]);
              gl.info.autoReset = true;
              (window as typeof window & {
                __PIXL_EDITOR_RENDERER__?: THREE.WebGLRenderer;
              }).__PIXL_EDITOR_RENDERER__ = gl;
            }}
          >
            {/* Audio Listener MUST be first inside Canvas */}
            <AudioListenerComponent />
            <EditorScene />
          </Canvas>
        </CanvasErrorBoundary>
      )}
    </div>
  );
};

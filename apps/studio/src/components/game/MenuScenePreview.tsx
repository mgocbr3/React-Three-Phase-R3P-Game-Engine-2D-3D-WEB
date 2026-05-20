import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, RapierRigidBody } from '@react-three/rapier';
import { Loader } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useTerrainStore } from '@/stores/terrainStore';
import { ActiveTerrain } from '@/components/terrain/ActiveTerrain';
import { EditableObject } from '@/components/canvas/EditableObject';
import { MinecraftPlayer } from '@/components/canvas/primitives/MinecraftPlayer';
import { ScriptRunner } from '@/components/canvas/ScriptRunner';
import { AutoInstancer } from '@/components/canvas/AutoInstancer';
import { SceneFog } from '@/components/canvas/SceneFog';
import { AtmosphericLighting } from '@/components/canvas/AtmosphericLighting';
import { PostProcessingEffects } from '@/components/canvas/PostProcessingEffects';
import { AdaptivePerformance } from '@/components/canvas/AdaptivePerformance';

interface CameraOverride {
  position: [number, number, number];
  target?: [number, number, number];
  fov?: number;
}

const CameraLookAt = ({ target }: { target: [number, number, number] }) => {
  const { camera } = useThree();
  useFrame(() => {
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
};

export const MenuScenePreview = ({ cameraOverride }: { cameraOverride?: CameraOverride }) => {
  const { objects, getCamera, getPlayer, loadSavedProject, hasSavedProject } = useEditorStore((s) => ({
    objects: s.objects,
    getCamera: s.getCamera,
    getPlayer: s.getPlayer,
    loadSavedProject: s.loadSavedProject,
    hasSavedProject: s.hasSavedProject,
  }));
  const { terrainSettings, isTerrainActive } = useTerrainStore();
  const engineSettings = useEngineSettings();

  const playerRef = useRef<THREE.Object3D>(null!);
  const rigidBodies = useRef<Map<string, RapierRigidBody>>(new Map());
  const groups = useRef<Map<string, THREE.Group>>(new Map());

  const cameraObject = getCamera();
  const playerObject = getPlayer();
  const cameraSettings = cameraObject?.cameraSettings;
  const playerSettings = playerObject?.playerSettings;

  const basePlayerPosition = playerObject?.position || [0, 1.5, 0];
  const playerPosition: [number, number, number] = useMemo(() => {
    if (isTerrainActive && terrainSettings) {
      return [basePlayerPosition[0], terrainSettings.height + 5, basePlayerPosition[2]];
    }
    return basePlayerPosition as [number, number, number];
  }, [basePlayerPosition, isTerrainActive, terrainSettings]);

  // Force play mode while previewing to disable editor gizmos/interactions.
  useEffect(() => {
    const prev = useEditorStore.getState().isEditMode;
    useEditorStore.getState().setEditMode(false);
    return () => useEditorStore.getState().setEditMode(prev);
  }, []);

  // Auto-restore last local project so the menu can show the real scene even when opened standalone.
  useEffect(() => {
    if (objects.length === 0 && hasSavedProject()) {
      loadSavedProject();
    }
  }, [objects.length, hasSavedProject, loadSavedProject]);

  const toneMappingExposure = Math.min(engineSettings.toneMappingExposure, 0.9);

  const glConfig = useMemo(() => ({
    antialias: engineSettings.antialias,
    toneMapping: getToneMappingType(engineSettings.toneMapping),
    toneMappingExposure,
    outputColorSpace: engineSettings.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace,
    powerPreference: 'high-performance' as const,
    stencil: false,
    depth: true,
    alpha: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
    precision: 'highp' as const,
  }), [engineSettings.antialias, engineSettings.toneMapping, engineSettings.colorSpace, toneMappingExposure]);

  const cameraProps = useMemo(() => {
    if (cameraOverride) {
      return {
        position: cameraOverride.position,
        fov: cameraOverride.fov ?? 50,
        near: 0.1,
        far: 2000,
      };
    }

    if (cameraSettings) {
      const distance = cameraSettings.distance || 10;
      const height = cameraSettings.height || 5;
      return {
        position: [playerPosition[0] - distance, playerPosition[1] + height, playerPosition[2] + distance] as [number, number, number],
        fov: cameraSettings.fov ?? 50,
        near: 0.1,
        far: 2000,
      };
    }

    return { position: [10, 10, 10] as [number, number, number], fov: 50, near: 0.1, far: 2000 };
  }, [cameraOverride, cameraSettings, playerPosition]);

  const lookAtTarget = useMemo(() => {
    if (cameraOverride?.target) return cameraOverride.target;
    if (cameraSettings?.targetId === 'main-player') return playerPosition;
    if (cameraSettings?.targetId) {
      const targetObj = objects.find((o) => o.id === cameraSettings.targetId);
      if (targetObj) return targetObj.position as [number, number, number];
    }
    return null;
  }, [cameraOverride?.target, cameraSettings?.targetId, objects, playerPosition]);

  return (
    <>
      <Canvas
        key={`menu-preview-${objects.length}`}
        shadows
        dpr={[1, engineSettings.maxDpr || 1.5]}
        camera={cameraProps}
        gl={glConfig}
        style={{ pointerEvents: 'none', background: '#0a0c14' }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#0a0c14']} />
          <Physics gravity={[0, -(playerSettings?.gravity || 20), 0]} paused={false}>
            <ActiveTerrain />

            {objects.map((obj) => (
              <EditableObject key={obj.id} object={obj} rigidBodies={rigidBodies} groups={groups} />
            ))}

            {/* Fallback ground if scene is empty and no terrain */}
            {objects.length === 0 && !isTerrainActive && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
                <planeGeometry args={[200, 200, 1, 1]} />
                <meshStandardMaterial color="#1f2433" roughness={0.9} />
              </mesh>
            )}

            <MinecraftPlayer
              ref={playerRef}
              position={playerPosition as [number, number, number]}
              skinColors={{
                skin: '#c4a574',
                hair: '#3d2314',
                shirt: '#00aaaa',
                pants: '#1a1a7a',
                shoes: '#4a4a4a',
              }}
              playerSettings={playerSettings}
              cameraSettings={cameraSettings}
            />

            <ScriptRunner rigidBodies={rigidBodies} groups={groups} />
            <AutoInstancer />
          </Physics>

          <SceneFog />
          {/* Basic lights so the scene is visible even without template-specific lighting */}
          <ambientLight intensity={0.18} />
          <hemisphereLight intensity={0.2} groundColor="#0b0d16" color="#23304f" />
          <directionalLight
            position={[10, 15, 10]}
            intensity={0.75}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <AtmosphericLighting />
          <PostProcessingEffects />
          {lookAtTarget && <CameraLookAt target={lookAtTarget} />}
        </Suspense>
      </Canvas>

      <AdaptivePerformance
        enabled={engineSettings.autoQuality}
        onQualityChange={(preset, reason) => {
          console.log(`[MenuScenePreview] Quality -> ${preset} (${reason})`);
        }}
      />

      <Loader 
        containerStyles={{ backgroundColor: 'hsl(240, 15%, 5%)' }}
        barStyles={{ backgroundColor: 'hsl(270, 95%, 65%)' }}
        dataStyles={{ color: 'hsl(210, 40%, 98%)' }}
      />
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

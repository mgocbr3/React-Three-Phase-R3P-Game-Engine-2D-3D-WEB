import React, { Suspense, useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { 
  Grid, 
  GizmoHelper, 
  GizmoViewport,
} from '@react-three/drei';
import * as THREE from 'three';
import { RapierRigidBody } from '@react-three/rapier';
import { useEditorStore } from '@/stores/editorStore';
import { useEngineSettings, QualityPreset } from '@/stores/engineSettingsStore';
import { useAssetDragStore } from '@/stores/assetDragStore';
import { useThreeMemoryMonitor } from '@/hooks/useThreeCleanup';
import { EditableObject } from './EditableObject';
import { GizmoInteractionLock } from './TransformGizmo';
import { MinecraftPlayer } from './primitives/MinecraftPlayer';
import { VehicleController } from './controllers/VehicleController';
import { FPSController } from './controllers/FPSController';
import { PlatformerController } from './controllers/PlatformerController';
import { FlyCamera } from './FlyCamera';
import { TouchCameraController } from './TouchCameraController';
import { GameCamera } from './GameCamera';
import { ScriptRunner } from './ScriptRunner';
import { PostProcessingEffects } from './PostProcessingEffects';
import { SceneFog } from './SceneFog';
import { AudioListener as AudioListenerComponent } from './AudioListener';
import { AdaptivePerformance } from './AdaptivePerformance';
import { AutoInstancer } from './AutoInstancer';
import { WebGLContextRecovery } from './WebGLContextRecovery';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { AtmosphericLighting } from './AtmosphericLighting';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsTouchDevice } from '@/hooks/use-touch-device';
import { ActiveTerrain } from '@/components/terrain/ActiveTerrain';
import { useTerrainStore } from '@/stores/terrainStore';
import { toast } from 'sonner';
import { PhaserViewport2D } from './PhaserViewport2D';
import { useViewportStore } from '@/stores/viewportStore';


const EditorScene = () => {
  const { objects, isEditMode, selectObject, getCamera, getPlayer, currentTemplateId } = useEditorStore();
  const engineSettings = useEngineSettings();
  const isMobile = useIsMobile();
  const isTouchDevice = useIsTouchDevice();
  const { terrainSettings, isTerrainActive } = useTerrainStore();
  const playerRef = useRef<THREE.Object3D>(null!);
  const rigidBodies = useRef<Map<string, RapierRigidBody>>(new Map());
  const groups = useRef<Map<string, THREE.Group>>(new Map());
  
  // Three.js memory monitoring
  const { gl } = useThree();
  useThreeMemoryMonitor(gl, 60); // Log memory stats every 60 seconds
  
  const cameraObject = getCamera();
  const playerObject = getPlayer();
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

  // Detect if a physical keyboard is likely available
  // iPads with Magic Keyboard should get FlyCamera even if screen is "mobile" size
  const [hasKeyboard, setHasKeyboard] = useState(false);

  // Detect if a fine pointer (mouse/trackpad/pen) is present.
  // This fixes iPad/hybrid devices where width is "mobile" but a mouse exists.
  const [hasFinePointer, setHasFinePointer] = useState(false);
  
  // Listen for any keyboard event to enable FlyCamera on iPad with keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Any physical key press means keyboard is available
      if (!hasKeyboard && ['w', 'a', 's', 'd', 'q', 'e'].includes(e.key.toLowerCase())) {
        setHasKeyboard(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasKeyboard]);

  // Mouse/trackpad detection via PointerEvents (more reliable than UA checks)
  useEffect(() => {
    // Initial media-query hint
    try {
      const mql = window.matchMedia?.('(any-pointer: fine)');
      if (mql?.matches) setHasFinePointer(true);
    } catch {
      // ignore
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (!hasFinePointer && (e.pointerType === 'mouse' || e.pointerType === 'pen')) {
        setHasFinePointer(true);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [hasFinePointer]);

  return (
    <>
      {/* Fly Camera - In Edit Mode for devices with keyboard (desktop, iPad with Magic Keyboard, etc.) */}
      {/* Enable if: not mobile OR keyboard detected OR mouse/trackpad detected */}
      {isEditMode && (!isMobile || hasKeyboard || hasFinePointer) && (
        <FlyCamera speed={15} fastSpeed={40} lookSpeed={0.003} />
      )}
      
      {/* Touch Camera - In Edit Mode for any device with touch capability (mobile, iPad, touchscreen desktop) */}
      {/* Can coexist with FlyCamera on hybrid devices like iPad with Magic Keyboard */}
      {isEditMode && isTouchDevice && <TouchCameraController />}
      
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

      {/* Gizmo Helper - Controlled by engine settings */}
      {engineSettings.showGizmo && isEditMode && (
        <GizmoHelper alignment="bottom-right" margin={[80, 140]}>
          <GizmoViewport 
            axisColors={['#ef4444', '#22c55e', '#3b82f6']} 
            labelColor="white"
            axisHeadScale={1}
          />
        </GizmoHelper>
      )}

      {/* Scene Objects */}
      <Suspense fallback={null}>
        <Physics paused={isEditMode} gravity={[0, -(playerSettings?.gravity || 20), 0]}>
          {/* Procedural Terrain - if active */}
          <ActiveTerrain />
          
          {/* Render ALL editable objects from the store */}
          {/* This includes NPCs, trees, houses, platforms, etc. that appear in the hierarchy */}
          {objects.map((obj) => (
            <EditableObject
              key={obj.id}
              object={obj}
              rigidBodies={rigidBodies}
              groups={groups}
            />
          ))}
          
          {/* Player/Vehicle - only in play mode, controller based on camera mode */}
          {!isEditMode && currentTemplateId === 'racing' ? (
            <VehicleController 
              ref={playerRef}
              position={playerPosition as [number, number, number]} 
              color="#f97316"
              maxSpeed={30}
              acceleration={20}
              turnSpeed={2.5}
            />
          ) : !isEditMode && cameraSettings?.mode === 'first-person' ? (
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
          )}
          
          {/* Script Executor - runs scripts in Play Mode */}
          <ScriptRunner rigidBodies={rigidBodies} groups={groups} />
          
          {/* Auto-Instancing for performance */}
          <AutoInstancer />
        </Physics>
      </Suspense>
      
      {/* Adaptive Performance Monitor */}
      <AdaptivePerformance 
        enabled={engineSettings.autoQuality}
        onQualityChange={(preset, reason) => {
          console.log(`[EditorCanvas] Quality changed to ${preset}: ${reason}`);
        }}
      />

      {/* Ultra-Realistic Atmospheric Lighting */}
      <AtmosphericLighting />

      {/* Post-Processing Effects */}
      <PostProcessingEffects />

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
  const { selectObject, isEditMode, addModelFromAsset } = useEditorStore();
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
  const handlePointerMissed = useCallback((e?: any) => {
    // DEBUG: Log pointer missed events
    console.log(` [EditorCanvas] onPointerMissed:`, {
      isEditMode,
      gizmoActive: GizmoInteractionLock.isActive(),
      transformMode: useEditorStore.getState().transformMode,
      event: e ? {
        type: e.type,
        pointerType: e.pointerType,
        button: e.button,
      } : 'no event',
    });
    
    if (!isEditMode) {
      console.log(` [EditorCanvas] BLOCKED: Not in edit mode`);
      return;
    }
    
    // Block deselection if gizmo is currently in use
    if (GizmoInteractionLock.isActive()) {
      console.log(` [EditorCanvas] BLOCKED: Gizmo is active`);
      return;
    }

    // Only allow deselection in "select" mode
    const { transformMode } = useEditorStore.getState();
    if (transformMode !== 'select') {
      console.log(` [EditorCanvas] BLOCKED: Not in select mode (mode=${transformMode})`);
      return;
    }
    
    // Deselect
    console.log(` [EditorCanvas]  DESELECTING (clicking empty space)`);
    selectObject(null);
  }, [isEditMode, selectObject]);
  
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

  // Calculate optimal DPR based on device
  const optimalDpr = useMemo(() => {
    const deviceDpr = Math.min(window.devicePixelRatio || 1, engineSettings.maxDpr);
    return [Math.max(0.5, engineSettings.dpr), Math.min(deviceDpr, engineSettings.maxDpr)] as [number, number];
  }, [engineSettings.dpr, engineSettings.maxDpr]);

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
            shadows={engineSettings.shadows ? { type: getShadowMapType(engineSettings.shadowMapType) } : false}
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

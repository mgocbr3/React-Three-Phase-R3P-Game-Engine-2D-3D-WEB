import { Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Environment, Stars, Loader } from '@react-three/drei';
import * as THREE from 'three';
import { TemplateId } from '@/stores/gameStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { AdventureTemplate } from './templates/AdventureTemplate';
import { FPSHorrorTemplate } from './templates/FPSHorrorTemplate';
import { RacingTemplate } from './templates/RacingTemplate';
import { RPGTemplate } from './templates/RPGTemplate';
import { PlatformerTemplate } from './templates/PlatformerTemplate';
import { SocialHubTemplate } from './templates/SocialHubTemplate';
import { HyperRealisticTemplate } from './templates/HyperRealisticTemplate';
import { GTA6Template } from './templates/GTA6Template';

interface CameraOverride {
  position: [number, number, number];
  target?: [number, number, number];
  fov?: number;
}

interface GameCanvasProps {
  templateId: TemplateId;
  cameraOverride?: CameraOverride;
}

const TemplateRenderer = ({ templateId }: { templateId: TemplateId }) => {
  switch (templateId) {
    case 'adventure':
      return <AdventureTemplate />;
    case 'fps-horror':
      return <FPSHorrorTemplate />;
    case 'racing':
      return <RacingTemplate />;
    case 'rpg-topdown':
      return <RPGTemplate />;
    case 'platformer-2d':
      return <PlatformerTemplate />;
    case 'social-hub':
      return <SocialHubTemplate />;
    case 'hyper-realistic':
      return <HyperRealisticTemplate />;
    case 'gta6-vice-city':
      return <GTA6Template />;
    default:
      return <AdventureTemplate />;
  }
};

const CameraLookAt = ({ target }: { target: [number, number, number] }) => {
  const { camera } = useThree();
  useFrame(() => {
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
};

export const GameCanvas = ({ templateId, cameraOverride }: GameCanvasProps) => {
  const isHorror = templateId === 'fps-horror';
  const isRPG = templateId === 'rpg-topdown';
  const engineSettings = useEngineSettings();

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

  const toneMappingExposure = Math.min(engineSettings.toneMappingExposure, 0.9);

  const glConfig = useMemo(() => ({
    antialias: engineSettings.antialias,
    toneMapping: getToneMappingType(engineSettings.toneMapping),
    toneMappingExposure: toneMappingExposure,
    outputColorSpace: engineSettings.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace,
    powerPreference: 'high-performance' as const,
    stencil: false,
    depth: true,
    alpha: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
    precision: 'highp' as const,
  }), [engineSettings.antialias, engineSettings.toneMapping, toneMappingExposure, engineSettings.colorSpace]);
  
  const cameraProps = cameraOverride
    ? {
        position: cameraOverride.position as [number, number, number],
        fov: cameraOverride.fov ?? 50,
        near: 0.1,
        far: 2000,
      }
    : isRPG
      ? { position: [0, 20, 0] as [number, number, number], fov: 50, near: 0.1, far: 1000 }
      : undefined;

  return (
    <>
      <Canvas
        shadows
        camera={cameraProps}
        gl={glConfig}
        style={{ background: isHorror ? '#0a0a0a' : '#1a1a2e' }}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]}>
            <TemplateRenderer templateId={templateId} />
          </Physics>
          {cameraOverride?.target && <CameraLookAt target={cameraOverride.target} />}
          
          {/* Lighting based on template */}
          {!isHorror && (
            <>
              <ambientLight intensity={0.06} />
              <directionalLight
                position={[10, 15, 10]}
                intensity={0.7}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-far={50}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
              />
              <Environment preset="studio" environmentIntensity={0.2} background={false} />
              {templateId === 'social-hub' && <Stars radius={100} depth={50} count={2000} factor={4} />}
            </>
          )}
        </Suspense>
      </Canvas>
      <Loader 
        containerStyles={{ backgroundColor: 'hsl(240, 15%, 5%)' }}
        barStyles={{ backgroundColor: 'hsl(270, 95%, 65%)' }}
        dataStyles={{ color: 'hsl(210, 40%, 98%)' }}
      />
    </>
  );
};

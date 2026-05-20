import { useMemo } from 'react';
import { Sky, Cloud, Stars, Environment } from '@react-three/drei';
import { useEditorStore } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';

/**
 * AtmosphericLighting - Environment (IBL) + balanced fill lights
 *  Skybox customizado não é suportado - usando Environment presets
 */
export const AtmosphericLighting = () => {
  const objects = useEditorStore((state) => state.objects);
  const engineSettings = useEngineSettings();
  
  // Find sun light in the scene
  const sunLight = useMemo(() => {
    return objects.find(obj => obj.type === 'sunlight' && obj.visible);
  }, [objects]);
  
  // Determine time of day based on sun elevation
  const timeOfDay = useMemo(() => {
    const elevation = sunLight?.lightSettings?.sunElevation ?? 45;
    if (elevation < 5) return 'night';
    if (elevation < 20) return 'sunset';
    if (elevation < 40) return 'morning';
    return 'day';
  }, [sunLight]);

  const isNight = timeOfDay === 'night';
  const isSunset = timeOfDay === 'sunset';
  const isMorning = timeOfDay === 'morning';
  
  // Sky color based on time of day
  const skyColor = isNight ? '#0a0a2a' : isSunset ? '#ff9966' : isMorning ? '#b6d9f2' : '#87ceeb';
  const groundColor = isNight ? '#0a0a1a' : isSunset ? '#664422' : '#3d5c3d';
  
  // Lighting balance - progressive from night to day
  // night (0-5°) → sunset (5-20°) → morning (20-40°) → day (40°+)
  const ambientIntensity = isNight ? 0.02 : isSunset ? 0.04 : isMorning ? 0.08 : 0.12;
  const hemisphereIntensity = isNight ? 0.05 : isSunset ? 0.08 : isMorning ? 0.12 : 0.18;
  const envPreset = isNight ? 'night' : isSunset ? 'sunset' : isMorning ? 'dawn' : 'city';
  const envIntensity = isNight ? 0.05 : isSunset ? 0.07 : isMorning ? 0.09 : 0.12;

  return (
    <>
      {/* Solid sky background color */}
      <color attach="background" args={[skyColor]} />
      
      {/* Environment (IBL) - skybox lighting only */}
      <Environment
        preset={envPreset}
        background={false}
        blur={0.9}
        environmentIntensity={envIntensity}
      />
      
      {/* Stars at night */}
      {isNight && (
        <Stars
          radius={100}
          depth={50}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />
      )}
      
      {/* Ambient light - general fill */}
      <ambientLight 
        color={isNight ? '#1a1a3a' : '#ffffff'} 
        intensity={ambientIntensity}
      />
      
      {/* Hemisphere light - sky/ground color bounce */}
      <hemisphereLight
        color={skyColor}
        groundColor={groundColor}
        intensity={hemisphereIntensity}
      />
      
      {/* Fallback directional light only if no sun light in scene */}
      {!sunLight && (
        <directionalLight
          position={[50, 50, 50]}
          intensity={0.6}
          color="#fffaf0"
          castShadow={engineSettings.shadows}
          shadow-mapSize={[engineSettings.shadowMapSize, engineSettings.shadowMapSize]}
          shadow-bias={-0.001}
          shadow-camera-near={0.5}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
      )}
    </>
  );

  /* INÍCIO DO CÓDIGO COMENTADO - DESCOMENTE GRADUALMENTE
  
  const objects = useEditorStore((state) => state.objects);
  const engineSettings = useEngineSettings();
  
  // Find sun light in the scene
  const sunLight = useMemo(() => {
    return objects.find(obj => obj.type === 'sunlight' && obj.visible);
  }, [objects]);
  
  // Calculate sun position from light settings
  const sunPosition = useMemo((): [number, number, number] => {
    const elevation = sunLight?.lightSettings?.sunElevation ?? 45;
    const azimuth = sunLight?.lightSettings?.sunAzimuth ?? 180;
    
    const elevationRad = (elevation * Math.PI) / 180;
    const azimuthRad = (azimuth * Math.PI) / 180;
    
    const distance = 100;
    const x = Math.cos(azimuthRad) * Math.cos(elevationRad) * distance;
    const y = Math.sin(elevationRad) * distance;
    const z = Math.sin(azimuthRad) * Math.cos(elevationRad) * distance;
    
    return [x, y, z];
  }, [sunLight]);
  
  // Determine time of day based on sun elevation
  const timeOfDay = useMemo(() => {
    const elevation = sunLight?.lightSettings?.sunElevation ?? 45;
    if (elevation < 5) return 'night';
    if (elevation < 20) return 'sunset';
    if (elevation < 40) return 'morning';
    return 'day';
  }, [sunLight]);

  const isNight = timeOfDay === 'night';
  const isSunset = timeOfDay === 'sunset';
  const isMorning = timeOfDay === 'morning';
  
  // Sky color based on time of day
  const skyColor = isNight ? '#0a0a2a' : isSunset ? '#ff9966' : isMorning ? '#b6d9f2' : '#87ceeb';
  const groundColor = isNight ? '#0a0a1a' : isSunset ? '#664422' : '#3d5c3d';
  
  // Lighting balance (kept subtle to avoid washed out look)
  const ambientIntensity = isNight ? 0.03 : isSunset ? 0.05 : isMorning ? 0.06 : 0.08;
  const hemisphereIntensity = isNight ? 0.08 : isSunset ? 0.1 : isMorning ? 0.12 : 0.14;
  const envPreset = isNight ? 'night' : isSunset ? 'sunset' : isMorning ? 'dawn' : 'studio';
  const envIntensity = isNight ? 0.08 : isSunset ? 0.12 : isMorning ? 0.15 : 0.18;

  return (
    <>
      {/* 1. TESTE: Sky - Visual background *}
      <Sky
        distance={1000}
        sunPosition={sunPosition}
        inclination={0.52}
        azimuth={0.25}
        turbidity={10}
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* 2. TESTE: Environment (IBL) - adds skybox lighting without overriding Sky *}
      <Environment
        preset={envPreset}
        background={false}
        blur={0.4}
        environmentIntensity={envIntensity}
      />
      
      {/* 3. TESTE: Stars at night *}
      {isNight && (
        <Stars
          radius={100}
          depth={50}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />
      )}
      
      {/* 4. TESTE: Subtle clouds *}
      {!isNight && (
        <Cloud
          opacity={0.3}
          speed={0.1}
          segments={20}
          bounds={[20, 3, 20]}
          position={[0, 30, -40]}
          color="#ffffff"
        />
      )}
      
      {/* 5. TESTE: Ambient light - general fill *}
      <ambientLight 
        color={isNight ? '#1a1a3a' : '#ffffff'} 
        intensity={ambientIntensity}
      />
      
      {/* 6. TESTE: Hemisphere light - sky/ground color bounce *}
      <hemisphereLight
        color={skyColor}
        groundColor={groundColor}
        intensity={hemisphereIntensity}
      />
      
      {/* 7. TESTE: Fallback directional light only if no sun light in scene *}
      {!sunLight && (
        <directionalLight
          position={[50, 50, 50]}
          intensity={0.6}
          color="#fffaf0"
          castShadow={engineSettings.shadows}
          shadow-mapSize={[engineSettings.shadowMapSize, engineSettings.shadowMapSize]}
          shadow-bias={-0.001}
          shadow-camera-near={0.5}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
      )}
    </>
  );
  
  FIM DO CÓDIGO COMENTADO */
};

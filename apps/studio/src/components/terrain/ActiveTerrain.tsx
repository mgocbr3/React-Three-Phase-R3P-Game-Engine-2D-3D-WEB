import { useTerrainStore } from '@/stores/terrainStore';
import { TerrainGenerator } from './TerrainGenerator';

/**
 * Hook + Component combo for rendering active terrain in the scene
 * Uses a key based on terrain settings to force immediate re-render on changes
 */
export const ActiveTerrain = () => {
  const { terrainSettings, isTerrainActive } = useTerrainStore();

  if (!isTerrainActive || !terrainSettings) {
    return null;
  }

  // Create a key that changes when terrain settings change for immediate re-render
  const terrainKey = `terrain-${terrainSettings.seed}-${terrainSettings.terrainSize}-${terrainSettings.height}-${terrainSettings.waterLevel}-${terrainSettings.segmentsX}-${terrainSettings.biome}-${terrainSettings.mountainousness}-${terrainSettings.erosionStrength}`;

  return (
    <TerrainGenerator
      key={terrainKey}
      seed={terrainSettings.seed}
      scale={terrainSettings.scale}
      height={terrainSettings.height}
      waterLevel={terrainSettings.waterLevel}
      segmentsX={terrainSettings.segmentsX}
      segmentsY={terrainSettings.segmentsY}
      showVegetation={terrainSettings.showVegetation}
      vegetationDensity={terrainSettings.vegetationDensity}
      enableCollision={terrainSettings.enableCollision}
      terrainSize={terrainSettings.terrainSize}
      // Water settings
      waterColor={terrainSettings.waterColor}
      waterDeepColor={terrainSettings.waterDeepColor}
      waveHeight={terrainSettings.waveHeight}
      waveSpeed={terrainSettings.waveSpeed}
      waterOpacity={terrainSettings.waterOpacity}
      foamIntensity={terrainSettings.foamIntensity}
      // Biome settings
      biome={terrainSettings.biome}
      erosionStrength={terrainSettings.erosionStrength}
      flatness={terrainSettings.flatness}
      mountainousness={terrainSettings.mountainousness}
      coastalBlend={terrainSettings.coastalBlend}
    />
  );
};

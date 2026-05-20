import { create } from 'zustand';
import { useEditorStore } from './editorStore';

export type TerrainBiome = 'tropical' | 'temperate' | 'alpine' | 'desert' | 'island' | 'canyon' | 'mixed';

export interface TerrainSettings {
  seed: number;
  scale: number;
  height: number;
  waterLevel: number;
  segmentsX: number;
  segmentsY: number;
  showVegetation: boolean;
  vegetationDensity: number;
  enableCollision: boolean;
  terrainSize: number;
  // Water settings
  waterColor: string;
  waterDeepColor: string;
  waveHeight: number;
  waveSpeed: number;
  waterOpacity: number;
  foamIntensity: number;
  // Biome settings
  biome: TerrainBiome;
  erosionStrength: number;
  flatness: number;
  mountainousness: number;
  coastalBlend: number;
}

interface TerrainStore {
  terrainSettings: TerrainSettings | null;
  isTerrainActive: boolean;
  isModalOpen: boolean;
  
  // Actions
  createTerrain: (settings: TerrainSettings) => void;
  updateTerrainSettings: (settings: Partial<TerrainSettings>) => void;
  deleteTerrain: () => void;
  setModalOpen: (open: boolean) => void;
}

export const defaultTerrainSettings: TerrainSettings = {
  seed: 42,
  scale: 0.02,
  height: 30,
  waterLevel: 2,
  segmentsX: 128,
  segmentsY: 128,
  showVegetation: true,
  vegetationDensity: 0.4,
  enableCollision: true,
  terrainSize: 200,
  // Water defaults
  waterColor: '#1ca3ec',
  waterDeepColor: '#0c2d4a',
  waveHeight: 0.8,
  waveSpeed: 1.0,
  waterOpacity: 0.85,
  foamIntensity: 0.5,
  // Biome defaults
  biome: 'temperate',
  erosionStrength: 0.5,
  flatness: 0.4,
  mountainousness: 0.5,
  coastalBlend: 0.3,
};

export const useTerrainStore = create<TerrainStore>((set) => ({
  terrainSettings: null,
  isTerrainActive: false,
  isModalOpen: false,

  createTerrain: (settings: TerrainSettings) => {
    set({
      terrainSettings: settings,
      isTerrainActive: true,
      isModalOpen: false,
    });
    
    // Add terrain to scene hierarchy
    const editorStore = useEditorStore.getState();
    editorStore.addObject('terrain', [0, 0, 0]);
    
    // Update the created terrain object with our settings
    const terrainObject = editorStore.objects.find(obj => obj.type === 'terrain');
    if (terrainObject) {
      editorStore.updateObject(terrainObject.id, {
        id: 'terrain-main',
        name: 'Pixlland Terrain',
        terrainSettings: settings,
        visualSettings: {
          textureUrl: '',
          opacity: 1,
          metalness: 0,
          roughness: 1,
          emissiveIntensity: 0,
          wireframe: false,
          castShadow: true,
          receiveShadow: true,
        },
      });
    }
  },

  updateTerrainSettings: (partialSettings: Partial<TerrainSettings>) => {
    set((state) => ({
      terrainSettings: state.terrainSettings
        ? { ...state.terrainSettings, ...partialSettings }
        : { ...defaultTerrainSettings, ...partialSettings },
    }));
    
    // Update terrain object in scene hierarchy
    const editorStore = useEditorStore.getState();
    const terrainObject = editorStore.objects.find(obj => obj.id === 'terrain-main');
    if (terrainObject) {
      editorStore.updateObject('terrain-main', {
        terrainSettings: {
          ...terrainObject.terrainSettings,
          ...partialSettings,
        } as TerrainSettings,
      });
    }
  },

  deleteTerrain: () => {
    set({
      terrainSettings: null,
      isTerrainActive: false,
      isModalOpen: false,
    });
    
    // Remove terrain from scene hierarchy
    const editorStore = useEditorStore.getState();
    const terrainObject = editorStore.objects.find(obj => obj.id === 'terrain-main');
    if (terrainObject) {
      editorStore.deleteObject('terrain-main');
    }
  },

  setModalOpen: (open: boolean) => {
    set({ isModalOpen: open });
  },
}));

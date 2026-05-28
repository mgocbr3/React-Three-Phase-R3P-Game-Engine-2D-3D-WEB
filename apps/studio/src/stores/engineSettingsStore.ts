import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShadowMapType = 'basic' | 'percentage' | 'soft' | 'variance';
export type ToneMappingType = 'aces' | 'cineon' | 'reinhard' | 'linear' | 'none';
export type ColorSpaceType = 'srgb' | 'linear';
export type QualityPreset = 'ultra-low' | 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export type UITheme = 'black' | 'light';

export interface EngineSettings {
  // Rendering
  antialias: boolean;
  shadows: boolean;
  shadowMapType: ShadowMapType;
  shadowMapSize: number;
  textureFilterDefault: 'nearest' | 'bilinear' | 'trilinear';
  
  // Color & Tone
  toneMapping: ToneMappingType;
  toneMappingExposure: number;
  colorSpace: ColorSpaceType;
  
  // Performance
  dpr: number;
  maxDpr: number;
  frameloop: 'always' | 'demand' | 'never';
  
  // Post-Processing - Basic
  bloom: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;
  vignette: boolean;
  vignetteIntensity: number;
  vignetteOffset: number;
  noise: boolean;
  noiseIntensity: number;
  
  // Post-Processing - Advanced
  ssao: boolean;
  ssaoIntensity: number;
  ssaoRadius: number;
  ssaoBias: number;
  
  // Depth of Field
  depthOfField: boolean;
  dofFocusDistance: number;
  dofFocalLength: number;
  dofBokehScale: number;
  
  // Motion Blur
  motionBlur: boolean;
  motionBlurIntensity: number;
  motionBlurSamples: number;
  
  // Color Grading
  colorGrading: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  
  // Screen Space Reflections
  ssr: boolean;
  ssrIntensity: number;
  ssrMaxSteps: number;
  ssrThickness: number;
  
  // Chromatic Aberration
  chromaticAberration: boolean;
  chromaticAberrationOffset: number;
  
  // Lens Effects
  lensDistortion: boolean;
  lensDistortionAmount: number;
  
  // God Rays / Volumetric Light
  godRays: boolean;
  godRaysIntensity: number;
  godRaysDecay: number;
  godRaysDensity: number;
  
  // Environment
  fog: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientLightIntensity: number;
  
  // Grid & Helpers
  showGrid: boolean;
  gridSize: number;
  showGizmo: boolean;
  showStats: boolean;
  
  // Performance Monitoring & Auto-Quality
  autoQuality: boolean;
  targetFps: number;
  minFps: number;
  currentQualityPreset: QualityPreset;
  
  // LOD Settings
  lodEnabled: boolean;
  lodBias: number;
  
  // Instancing
  instancingEnabled: boolean;
  instancingThreshold: number;
  
  // UI Appearance
  uiTheme: UITheme;
}

interface EngineSettingsStore extends EngineSettings {
  updateSettings: (settings: Partial<EngineSettings>) => void;
  resetToDefaults: () => void;
  applyQualityPreset: (preset: QualityPreset) => void;
}

// Quality presets for auto-adjustment
export const QUALITY_PRESETS: Record<QualityPreset, Partial<EngineSettings>> = {
  'ultra-low': {
    dpr: 0.5,
    maxDpr: 0.75,
    shadowMapSize: 256,
    shadows: false,
    bloom: false,
    ssao: false,
    antialias: false,
    fog: false,
    lodEnabled: true,
    lodBias: 0.5,
    instancingEnabled: true,
  },
  'low': {
    dpr: 0.75,
    maxDpr: 1,
    shadowMapSize: 512,
    shadows: true,
    bloom: false,
    ssao: false,
    antialias: false,
    lodEnabled: true,
    lodBias: 0.75,
    instancingEnabled: true,
  },
  'medium': {
    dpr: 1,
    maxDpr: 1.25,
    shadowMapSize: 1024,
    shadows: true,
    bloom: false,
    ssao: false,
    antialias: true,
    lodEnabled: true,
    lodBias: 1.0,
    instancingEnabled: true,
  },
  'high': {
    dpr: 1,
    maxDpr: 1.5,
    shadowMapSize: 1536,
    shadows: true,
    bloom: true,
    bloomIntensity: 0.3,
    ssao: false,
    antialias: true,
    lodEnabled: true,
    lodBias: 1.25,
    instancingEnabled: true,
  },
  'ultra': {
    dpr: 1.25,
    maxDpr: 2,
    shadowMapSize: 2048,
    shadows: true,
    bloom: true,
    bloomIntensity: 0.5,
    ssao: true,
    antialias: true,
    lodEnabled: true,
    lodBias: 1.5,
    instancingEnabled: true,
  },
  'custom': {},
};

const defaultSettings: EngineSettings = {
  // Rendering
  antialias: true,
  shadows: true,
  shadowMapType: 'soft',
  shadowMapSize: 2048,
  textureFilterDefault: 'trilinear',
  
  // Color & Tone
  toneMapping: 'aces',
  toneMappingExposure: 1.0,
  colorSpace: 'srgb',
  
  // Performance
  dpr: 1,
  maxDpr: 2,
  frameloop: 'always',
  
  // Post-Processing - Basic — ULTRA REALISM defaults (all on)
  bloom: true,
  bloomIntensity: 0.6,
  bloomThreshold: 0.85,
  bloomRadius: 0.5,
  vignette: true,
  vignetteIntensity: 0.4,
  vignetteOffset: 0.3,
  noise: true,
  noiseIntensity: 0.04,

  // Post-Processing - Advanced — HBAO on by default
  ssao: true,
  ssaoIntensity: 0.8,
  ssaoRadius: 5,
  ssaoBias: 35,

  // Depth of Field
  depthOfField: false,
  dofFocusDistance: 10,
  dofFocalLength: 50,
  dofBokehScale: 2,

  // Motion Blur
  motionBlur: false,
  motionBlurIntensity: 0.5,
  motionBlurSamples: 16,
  
  // Color Grading
  colorGrading: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  
  // Screen Space Global Illumination (re-purposed `ssr` toggle drives
  // SSGIEffect which is a superset — diffuse bounce + reflections).
  // ON by default for the ultra-realism preset.
  ssr: true,
  ssrIntensity: 1.0,
  ssrMaxSteps: 24,
  ssrThickness: 1.5,
  
  // Chromatic Aberration
  chromaticAberration: false,
  chromaticAberrationOffset: 0.002,
  
  // Lens Distortion
  lensDistortion: false,
  lensDistortionAmount: 0.1,
  
  // God Rays
  godRays: false,
  godRaysIntensity: 0.5,
  godRaysDecay: 0.93,
  godRaysDensity: 0.96,
  
  // Environment
  fog: false,
  fogColor: '#c8dde8',
  fogNear: 100,
  fogFar: 200,
  ambientLightIntensity: 0.5,
  
  // Grid & Helpers
  showGrid: true,
  gridSize: 100,
  showGizmo: true,
  showStats: true,
  
  // Performance Monitoring
  autoQuality: false,
  targetFps: 60,
  minFps: 30,
  currentQualityPreset: 'high',
  
  // LOD
  lodEnabled: true,
  lodBias: 1.0,
  
  // Instancing
  instancingEnabled: true,
  instancingThreshold: 5,
  
  // UI Appearance
  uiTheme: 'black',
};

export const normalizeUITheme = (theme: unknown): UITheme => (
  theme === 'light' ? 'light' : 'black'
);

const sanitizePersistedSettings = (persistedState: unknown): Partial<EngineSettings> => {
  if (!persistedState || typeof persistedState !== 'object') {
    return {};
  }

  const settings = { ...(persistedState as Record<string, unknown>) };
  const { uiTheme } = settings;
  delete settings.uiTheme;
  delete settings.menuTransparency;

  return {
    ...settings,
    uiTheme: normalizeUITheme(uiTheme),
  } as Partial<EngineSettings>;
};

export const useEngineSettings = create<EngineSettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      
      updateSettings: (settings) => set((state) => ({
        ...state,
        ...settings,
        uiTheme: normalizeUITheme(settings.uiTheme ?? state.uiTheme),
      })),
      
      resetToDefaults: () => set(defaultSettings),
      
      applyQualityPreset: (preset) => set((state) => ({
        ...state,
        ...QUALITY_PRESETS[preset],
        currentQualityPreset: preset,
      })),
    }),
    {
      name: 'pixl-engine-settings',
      version: 2,
      migrate: (persistedState) => sanitizePersistedSettings(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedSettings(persistedState),
      }),
      partialize: (state) => {
        // Exclude functions from persistence
        const { updateSettings, resetToDefaults, applyQualityPreset, ...settings } = state;
        return settings;
      },
    }
  )
);

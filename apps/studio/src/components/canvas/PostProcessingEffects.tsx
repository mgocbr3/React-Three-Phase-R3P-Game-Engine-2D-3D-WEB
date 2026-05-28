import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEngineSettings, type ToneMappingType } from '@/stores/engineSettingsStore';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toneMappingMode = (mode: ToneMappingType) => {
  switch (mode) {
    case 'cineon': return ToneMappingMode.CINEON;
    case 'linear': return ToneMappingMode.LINEAR;
    case 'reinhard': return ToneMappingMode.REINHARD;
    case 'aces':
    default: return ToneMappingMode.ACES_FILMIC;
  }
};

export const PostProcessingEffects = () => {
  const settings = useEngineSettings();
  const hasTone = settings.toneMapping !== 'none';
  const hasGrade = settings.colorGrading;
  const enabled = hasTone || hasGrade || settings.bloom;

  if (!enabled) return null;

  return (
    <EffectComposer multisampling={settings.antialias ? 4 : 0}>
      {settings.bloom && (
        <Bloom
          intensity={clamp(settings.bloomIntensity, 0, 0.25)}
          luminanceThreshold={clamp(settings.bloomThreshold, 0.88, 1)}
          luminanceSmoothing={0.025}
          mipmapBlur
          radius={clamp(settings.bloomRadius, 0, 0.35)}
        />
      )}
      {hasGrade && (
        <>
          <BrightnessContrast
            brightness={clamp(settings.brightness, -0.1, 0.1)}
            contrast={clamp(settings.contrast, -0.15, 0.15)}
          />
          <HueSaturation
            hue={clamp(settings.hue, -0.1, 0.1)}
            saturation={clamp(settings.saturation, -0.08, 0.08)}
          />
        </>
      )}
      {hasTone && <ToneMapping mode={toneMappingMode(settings.toneMapping)} />}
    </EffectComposer>
  );
};

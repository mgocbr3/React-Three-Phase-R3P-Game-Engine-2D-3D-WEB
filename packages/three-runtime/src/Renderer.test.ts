import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  resolveRendererToneMapping,
  shouldUseRendererPostProcessing,
} from './Renderer.js';

describe('Renderer post-processing helpers', () => {
  it('resolves Unity-like tone mapping presets to Three constants', () => {
    expect(resolveRendererToneMapping('aces')).toBe(THREE.ACESFilmicToneMapping);
    expect(resolveRendererToneMapping('cineon')).toBe(THREE.CineonToneMapping);
    expect(resolveRendererToneMapping('reinhard')).toBe(THREE.ReinhardToneMapping);
    expect(resolveRendererToneMapping('linear')).toBe(THREE.LinearToneMapping);
    expect(resolveRendererToneMapping('none')).toBe(THREE.NoToneMapping);
  });

  it('keeps the composer opt-in through renderer settings', () => {
    expect(shouldUseRendererPostProcessing({ enabled: true })).toBe(true);
    expect(shouldUseRendererPostProcessing({ enabled: false })).toBe(false);
    expect(shouldUseRendererPostProcessing()).toBe(false);
  });
});

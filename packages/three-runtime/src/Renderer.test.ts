import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  resolveRendererShadowMapType,
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
    expect(resolveRendererToneMapping()).toBe(THREE.NoToneMapping);
  });

  it('keeps the native renderer on the direct Wes path without composer effects', () => {
    expect(shouldUseRendererPostProcessing({ enabled: true })).toBe(false);
    expect(shouldUseRendererPostProcessing({ enabled: true, toneMapping: 'aces' })).toBe(false);
    expect(shouldUseRendererPostProcessing({ enabled: true, bloom: true })).toBe(false);
    expect(shouldUseRendererPostProcessing({ enabled: true, colorGrading: true })).toBe(false);
    expect(shouldUseRendererPostProcessing({ enabled: false })).toBe(false);
    expect(shouldUseRendererPostProcessing()).toBe(false);
  });

  it('uses point-light compatible shadow maps for Studio presets', () => {
    expect(resolveRendererShadowMapType()).toBe(THREE.PCFShadowMap);
    expect(resolveRendererShadowMapType('soft')).toBe(THREE.PCFShadowMap);
    expect(resolveRendererShadowMapType('percentage')).toBe(THREE.PCFShadowMap);
    expect(resolveRendererShadowMapType('basic')).toBe(THREE.BasicShadowMap);
    expect(resolveRendererShadowMapType('variance')).toBe(THREE.PCFShadowMap);
  });
});

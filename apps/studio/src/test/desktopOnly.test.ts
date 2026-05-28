import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { useInputMapStore } from '@/stores/inputMapStore';

const root = process.cwd();
const src = (...parts: string[]) => join(root, 'src', ...parts);

describe('desktop-only studio build', () => {
  it('does not ship the retired mobile editor surface', () => {
    const mobileDir = src('components/editor/mobile');
    expect(existsSync(mobileDir) ? readdirSync(mobileDir) : []).toEqual([]);
  });

  it('does not expose mobile/touch gameplay settings in the desktop editor', () => {
    const settingsModal = readFileSync(src('components/editor/EngineSettingsModal.tsx'), 'utf8');
    const engineSettings = readFileSync(src('stores/engineSettingsStore.ts'), 'utf8');
    const inputMapPanel = readFileSync(src('components/editor/InputMapPanel.tsx'), 'utf8');

    expect(settingsModal).not.toContain('Controles Touch');
    expect(engineSettings).not.toContain('showTouchControls');
    expect(inputMapPanel).not.toContain('gestos touch');
    expect(inputMapPanel).not.toContain("setCaptureType('touch')");
  });

  it('keeps editor chrome desktop-only instead of hiding commands at mobile breakpoints', () => {
    const editorHeader = readFileSync(src('components/editor/EditorHeader.tsx'), 'utf8');
    const editorPage = readFileSync(src('pages/EditorPage.tsx'), 'utf8');
    const css = readFileSync(src('index.css'), 'utf8');

    expect(editorHeader).not.toMatch(/hidden[^'"]*md:flex/);
    expect(editorPage).toContain('min-w-[1180px]');
    expect(css).toContain('overflow-x: auto');
  });

  it('keeps Unity-like editor chrome flat instead of stacking raised controls', () => {
    const editorHeader = readFileSync(src('components/editor/EditorHeader.tsx'), 'utf8');
    const css = readFileSync(src('index.css'), 'utf8');

    expect(editorHeader).not.toContain("boxShadow: 'inset");
    expect(editorHeader).toContain('editor-brand-button');
    expect(editorHeader).toContain('editor-project-tab');
    expect(css).toMatch(/\.editor-command-chip\s*{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
    expect(css).toMatch(/\.editor-panel-tab\.active\s*{[^}]*background:\s*var\(--editor-tab-active\);[^}]*border-color:\s*transparent;[^}]*box-shadow:\s*none;/s);
    expect(css).toMatch(/\.editor-panel-tab\.active::before\s*{[^}]*content:\s*none;/s);
    expect(css).toMatch(/\.editor-panel-action\s*{[^}]*background:\s*transparent;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;/s);
    expect(css).toMatch(/\.editor-panel-action:hover\s*{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
    expect(css).toMatch(/\.glass-search input\s*{[^}]*border:\s*1px solid transparent;[^}]*border-radius:\s*0;/s);
  });

  it('keeps 3D play-mode post processing sober and dependency-local', () => {
    const postProcessing = readFileSync(src('components/canvas/PostProcessingEffects.tsx'), 'utf8');

    expect(postProcessing).toContain('@react-three/postprocessing');
    expect(postProcessing).not.toContain('realism-effects');
    expect(postProcessing).not.toMatch(/Noise|Vignette|ChromaticAberration|Glitch|Scanline|MotionBlur/);
    expect(existsSync(src('components/canvas/effects/RealismEffects.tsx'))).toBe(false);
  });

  it('keeps editor shadow maps compatible with point lights', () => {
    const editorCanvas = readFileSync(src('components/canvas/EditorCanvas.tsx'), 'utf8');

    expect(editorCanvas).toContain('THREE.PCFShadowMap');
    expect(editorCanvas).not.toContain('THREE.PCFSoftShadowMap');
    expect(editorCanvas).not.toContain('THREE.VSMShadowMap');
  });

  it('defaults to keyboard and gamepad bindings only', () => {
    useInputMapStore.getState().resetToDefaults();

    const inputTypes = useInputMapStore
      .getState()
      .actions.flatMap((action) => action.bindings.map((binding) => binding.type));

    expect(inputTypes).not.toContain('touch');
  });

  it('does not accept new touch bindings through the desktop input map API', () => {
    useInputMapStore.getState().resetToDefaults();
    useInputMapStore.getState().addBinding('jump', {
      type: 'touch',
      gesture: 'button_jump',
      label: 'Botão Pulo',
    } as never);

    expect(useInputMapStore.getState().getActionById('jump')?.bindings.map((binding) => binding.type)).not.toContain('touch');
  });
});

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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

    expect(settingsModal).not.toContain('Controles Touch');
    expect(engineSettings).not.toContain('showTouchControls');
  });
});

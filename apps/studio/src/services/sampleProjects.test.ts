import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSampleEditorUrl, listSampleProjects } from './sampleProjects';

describe('sample projects', () => {
  it('locks 2D and 3D samples to the right editor kind', () => {
    expect(buildSampleEditorUrl('magic-battleground-2d')).toBe('/editor?sampleProject=magic-battleground-2d&engine=native&kind=2d');
    expect(buildSampleEditorUrl('magic-battleground-mvp')).toBe('/editor?sampleProject=magic-battleground-mvp&engine=native&kind=3d');
  });

  it('keeps internal placeholder demos out of the Hub', () => {
    expect(listSampleProjects().map((sample) => sample.slug)).not.toContain('magic-battleground-mvp');
    expect(listSampleProjects().map((sample) => sample.slug)).not.toContain('sample-2d');
  });

  it('uses the packaged Harvest Rush runtime instead of a missing external games-src checkout', () => {
    const harvest = listSampleProjects().find((sample) => sample.slug === 'harvest-rush-3d');
    expect(harvest?.runtimeBaseUrl).toBe('/sample-projects/harvest-rush-3d/runtime/');
    expect(harvest?.documentBaseUrl).toBe('/sample-projects/harvest-rush-3d/');
    expect(harvest?.assetBaseUrl).not.toContain('games-src');
  });

  it('ships the Harvest Rush runtime UI and level data with the standalone sample', () => {
    const root = resolve(process.cwd(), 'public/sample-projects/harvest-rush-3d');
    const css = readFileSync(resolve(root, 'runtime/src/styles.css'), 'utf8');

    expect(css).toContain('.game-shell');
    expect(css).toContain('.title-panel.open');
    expect(css).toContain("url('../../assets/");
    expect(existsSync(resolve(root, 'levels/harvest-rush.level3d.json'))).toBe(true);
  });
});

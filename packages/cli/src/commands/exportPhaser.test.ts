import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  EXPORT_PHASER_FORMAT,
  EXPORT_PHASER_FORMAT_VERSION,
  exportProjectToPhaser,
  rewritePhaserAssetUrlsInProject,
  runExportPhaser,
} from './exportPhaser.js';
import { PIXL_PROJECT_FORMAT, PIXL_PROJECT_VERSION, type PixlProjectShape } from '../schema.js';

const buildMinimalProject = (overrides: Partial<PixlProjectShape> = {}): PixlProjectShape => ({
  format: PIXL_PROJECT_FORMAT,
  version: PIXL_PROJECT_VERSION,
  id: 'test-2d',
  slug: 'test-2d',
  name: 'Test 2D',
  activeSceneId: 'arena',
  scenes: [
    {
      id: 'arena',
      name: 'Arena',
      kind: '2d',
      rootObjects: [
        {
          id: 'hero',
          name: 'Hero',
          type: 'sprite',
          data: { imageUrl: 'assets/hero.png', frameWidth: 32, frameHeight: 32 },
        },
      ],
      environment: { background: '#102030', pixelArt: true },
      physics: { engine: 'arcade', gravity: [0, 980] },
    },
  ],
  assets: {
    root: 'assets',
    folders: ['assets'],
    entries: [{ id: 'hero-img', name: 'Hero', kind: 'spritesheet', path: 'assets/hero.png' }],
  },
  engine: { name: 'PixlPlayground', version: '0.2.0' },
  runtime: { primary: 'phaser-2d', renderers: ['phaser'], physics: ['arcade'] },
  ...overrides,
});

describe('exportProjectToPhaser (pure)', () => {
  it('emits index.html and main.js for @pixlland/phaser-runtime', () => {
    const result = exportProjectToPhaser(buildMinimalProject({ name: 'Arcade <Arena>' }));
    expect(result.indexHtml).toContain('<title>Arcade &lt;Arena&gt;</title>');
    expect(result.indexHtml).toContain('<div id="game"></div>');
    expect(result.mainJsSource).toContain("import { Game } from '@pixlland/phaser-runtime';");
    expect(result.mainJsSource).toContain('Game.fromPixlProject(project');
    expect(result.mainJsSource).toContain("fetch('./project.pixlproject.json')");
  });

  it('emits a phaser manifest with project metadata', () => {
    const result = exportProjectToPhaser(buildMinimalProject(), { exportedAt: 123 });
    expect(result.manifest).toMatchObject({
      format: EXPORT_PHASER_FORMAT,
      formatVersion: EXPORT_PHASER_FORMAT_VERSION,
      exportedAt: 123,
      projectId: 'test-2d',
      projectName: 'Test 2D',
      activeSceneId: 'arena',
      sceneCount: 1,
      assetCount: 1,
      runtime: 'phaser-2d',
    });
  });

  it('rejects a project whose active scene is 3D', () => {
    const project = buildMinimalProject({
      scenes: [{ id: 'arena', name: 'Arena', kind: '3d', rootObjects: [] }],
    });
    expect(() => exportProjectToPhaser(project)).toThrow(/expected "2d" or "hybrid"/);
  });
});

describe('rewritePhaserAssetUrlsInProject (pure)', () => {
  it('rewrites data and component asset URLs to entry.path', () => {
    const project = buildMinimalProject({
      scenes: [
        {
          id: 'arena',
          name: 'Arena',
          kind: '2d',
          rootObjects: [
            {
              id: 'hero',
              name: 'Hero',
              type: 'sprite',
              data: { imageUrl: 'public/source/hero.png' },
              components: [
                {
                  id: 'sprite',
                  type: 'pixl.sprite',
                  enabled: true,
                  data: { texturePath: 'public/source/hero.png' },
                },
              ],
            },
          ],
        },
      ],
      assets: {
        root: 'assets',
        entries: [
          {
            id: 'hero-img',
            name: 'Hero',
            kind: 'image',
            path: 'assets/hero.png',
            url: 'public/source/hero.png',
          },
        ],
      },
    });

    const out = rewritePhaserAssetUrlsInProject(project);
    expect(out.rewriteCount).toBe(2);
    const hero = out.project.scenes[0]!.rootObjects[0]!;
    expect(hero.data!.imageUrl).toBe('assets/hero.png');
    expect(hero.components![0]!.data.texturePath).toBe('assets/hero.png');
    expect(project.scenes[0]!.rootObjects[0]!.data!.imageUrl).toBe('public/source/hero.png');
  });
});

describe('runExportPhaser (IO, skipBundle)', () => {
  it('writes standalone files, copies assets, and copies runtime scripts', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-phaser-'));
    const fs = await import('node:fs/promises');

    await fs.mkdir(join(tmp, 'assets'), { recursive: true });
    await fs.writeFile(join(tmp, 'assets', 'hero.png'), 'PNG');
    await fs.mkdir(join(tmp, 'runtime', 'src'), { recursive: true });
    await fs.writeFile(join(tmp, 'runtime', 'src', 'main.js'), 'export default () => {};');

    const project = buildMinimalProject({
      scenes: [
        {
          ...buildMinimalProject().scenes[0]!,
          runtimeScript: 'runtime/src/main.js',
        },
      ],
    });
    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(project), 'utf8');

    const outDir = join(tmp, 'out');
    const result = await runExportPhaser(projectPath, outDir, { skipBundle: true });

    expect(result.outDir).toBe(resolve(outDir));
    expect(result.assetCount).toBe(1);
    expect(result.missingAssets).toEqual([]);
    expect(result.copiedDirs).toEqual(['runtime']);
    expect(result.bundleSizeBytes).toBeGreaterThan(0);

    await expect(stat(join(outDir, 'index.html'))).resolves.toBeTruthy();
    await expect(stat(join(outDir, 'main.js'))).resolves.toBeTruthy();
    await expect(stat(join(outDir, 'manifest.json'))).resolves.toBeTruthy();
    await expect(stat(join(outDir, 'assets', 'hero.png'))).resolves.toBeTruthy();
    await expect(stat(join(outDir, 'runtime', 'src', 'main.js'))).resolves.toBeTruthy();

    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.runtime).toBe('phaser-2d');
  });
});

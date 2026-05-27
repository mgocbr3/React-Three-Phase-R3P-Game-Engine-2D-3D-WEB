import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { unpackPackage } from '@pixlland/engine-core';
import { readBytesFromFile } from '@pixlland/engine-core/node';

import { runExportPixlland } from './exportPixlland.js';
import { PIXL_PROJECT_FORMAT, PIXL_PROJECT_VERSION, type PixlProjectShape } from '../schema.js';

const transform = {
  position: [100, 100, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

const build2DProject = (overrides: Partial<PixlProjectShape> = {}): PixlProjectShape => ({
  format: PIXL_PROJECT_FORMAT,
  version: PIXL_PROJECT_VERSION,
  id: 'magic-package',
  name: 'Magic Package',
  activeSceneId: 'arena',
  scenes: [
    {
      id: 'arena',
      name: 'Arena',
      kind: '2d',
      runtimeScript: 'runtime/src/main.js',
      rootObjects: [
        {
          id: 'hero',
          name: 'Hero',
          type: 'sprite',
          transform,
          data: { imageUrl: 'assets/hero.png' },
        },
      ],
    },
  ],
  assets: {
    root: 'assets',
    entries: [{ id: 'hero-img', name: 'Hero', kind: 'image', path: 'assets/hero.png' }],
  },
  engine: { name: 'PixlPlayground', version: '0.2.0', schemaVersion: 2 },
  runtime: { primary: 'phaser-2d', renderers: ['phaser'], physics: ['arcade'] },
  ...overrides,
});

const build3DProject = (): PixlProjectShape => ({
  format: PIXL_PROJECT_FORMAT,
  version: PIXL_PROJECT_VERSION,
  id: 'three-package',
  slug: 'three-package',
  name: 'Three Package',
  createdAt: 1770000000000,
  activeSceneId: 'main',
  scenes: [{ id: 'main', name: 'Main', kind: '3d', rootObjects: [] }],
  engine: { name: 'PixlPlayground', version: '0.2.0', schemaVersion: 2 },
  runtime: { primary: 'three-3d', renderers: ['three'], physics: ['rapier3d'] },
});

describe('runExportPixlland', () => {
  it('exports a 2D project, packages the static build, and normalizes pack metadata', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-pixlland-'));
    const fs = await import('node:fs/promises');

    await fs.mkdir(join(tmp, 'assets'), { recursive: true });
    await fs.writeFile(join(tmp, 'assets', 'hero.png'), 'PNG');
    await fs.mkdir(join(tmp, 'runtime', 'src'), { recursive: true });
    await fs.writeFile(join(tmp, 'runtime', 'src', 'main.js'), 'export default () => {};');

    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(build2DProject()), 'utf8');

    const outFile = join(tmp, 'magic.pixlbuild');
    const buildDir = join(tmp, 'build');
    const result = await runExportPixlland(projectPath, outFile, {
      skipBundle: true,
      buildDir,
      exportedAt: 1771111111111,
      packedAt: 1771111111111,
    });

    expect(result.outFile).toBe(resolve(outFile));
    expect(result.runtime).toBe('phaser-2d');
    expect(result.sceneKind).toBe('2d');
    expect(result.buildDir).toBe(resolve(buildDir));
    expect(result.archiveSize).toBeGreaterThan(0);
    await expect(stat(outFile)).resolves.toBeTruthy();

    const unpacked = await unpackPackage(await readBytesFromFile(outFile));
    const paths = unpacked.files.map((file) => file.path);
    expect(paths).toEqual(expect.arrayContaining([
      'index.html',
      'main.js',
      'manifest.json',
      'project.pixlproject.json',
      'assets/hero.png',
      'runtime/src/main.js',
    ]));
    expect(unpacked.manifest.projectSlug).toBe('magic-package');
    expect(unpacked.manifest.runtime.primary).toBe('phaser-2d');

    const projectCopy = JSON.parse(
      await readFile(join(buildDir, 'project.pixlproject.json'), 'utf8'),
    ) as PixlProjectShape;
    expect(projectCopy.slug).toBe('magic-package');
    expect(projectCopy.createdAt).toBe(1771111111111);
  });

  it('routes 3D active scenes through the Three exporter', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-pixlland-3d-'));
    const fs = await import('node:fs/promises');
    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(build3DProject()), 'utf8');

    const outFile = join(tmp, 'three.pixlbuild');
    const result = await runExportPixlland(projectPath, outFile, {
      skipBundle: true,
      exportedAt: 1771111111111,
      packedAt: 1771111111111,
    });

    expect(result.runtime).toBe('three-3d');
    expect(result.sceneKind).toBe('3d');
    expect(result.buildDir).toBeNull();
    const unpacked = await unpackPackage(await readBytesFromFile(outFile));
    expect(unpacked.manifest.runtime.primary).toBe('three-3d');
    expect(unpacked.files.map((file) => file.path)).toEqual(expect.arrayContaining([
      'index.html',
      'main.js',
      'project.pixlproject.json',
    ]));
  });
});

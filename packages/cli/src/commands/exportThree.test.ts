import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  exportProjectToThree,
  runExportThree,
  EXPORT_THREE_FORMAT,
  EXPORT_THREE_FORMAT_VERSION,
} from './exportThree.js';
import { PIXL_PROJECT_FORMAT, PIXL_PROJECT_VERSION, type PixlProjectShape } from '../schema.js';

const buildMinimalProject = (overrides: Partial<PixlProjectShape> = {}): PixlProjectShape => ({
  format: PIXL_PROJECT_FORMAT,
  version: PIXL_PROJECT_VERSION,
  id: 'test-project',
  slug: 'test-project',
  name: 'Test Project',
  activeSceneId: 'main',
  scenes: [
    {
      id: 'main',
      name: 'Main',
      kind: '3d',
      rootObjects: [],
    },
  ],
  assets: {
    root: 'Assets',
    folders: ['Assets/3D_Models'],
    entries: [
      {
        id: 'asset-1',
        name: 'Cube',
        kind: 'model',
        path: 'Assets/3D_Models/cube.glb',
        url: 'Assets/3D_Models/cube.glb',
      },
    ],
  },
  engine: { name: 'PixlPlayground', version: '0.2.0' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Pure exporter
// ---------------------------------------------------------------------------

describe('exportProjectToThree (pure)', () => {
  it('emits index.html with project name as title and module script tag', () => {
    const project = buildMinimalProject({ name: 'My Game' });
    const result = exportProjectToThree(project);
    expect(result.indexHtml).toContain('<title>My Game</title>');
    expect(result.indexHtml).toContain('<script type="module" src="./main.js">');
    expect(result.indexHtml).toContain('<!doctype html>');
  });

  it('escapes HTML-unsafe characters in the title', () => {
    const project = buildMinimalProject({ name: 'A <script>alert("xss")</script>' });
    const result = exportProjectToThree(project);
    expect(result.indexHtml).not.toContain('<script>alert');
    expect(result.indexHtml).toContain('&lt;script&gt;');
    expect(result.indexHtml).toContain('&quot;xss&quot;');
  });

  it('emits main.js source that imports @pixlland/three-runtime and uses Game.loadFromPixlProject', () => {
    const project = buildMinimalProject();
    const result = exportProjectToThree(project);
    expect(result.mainJsSource).toContain("import { Game } from '@pixlland/three-runtime';");
    expect(result.mainJsSource).toContain('loadFromPixlProject(project)');
    expect(result.mainJsSource).toContain("fetch('./project.pixlproject.json')");
  });

  it('passes assetSourceBase through to new Game(...)', () => {
    const project = buildMinimalProject();
    const result = exportProjectToThree(project, { assetSourceBase: './Assets' });
    expect(result.mainJsSource).toContain('new Game("./Assets")');
  });

  it('collects unique asset paths from project.assets.entries', () => {
    const project = buildMinimalProject({
      assets: {
        root: 'Assets',
        entries: [
          { id: 'a', name: 'A', kind: 'model', path: 'Assets/A.glb' },
          { id: 'b', name: 'B', kind: 'model', path: 'Assets/B.glb' },
          { id: 'a-dupe', name: 'A copy', kind: 'model', path: 'Assets/A.glb' },
        ],
      },
    });
    const result = exportProjectToThree(project);
    expect(result.assetPaths).toEqual(['Assets/A.glb', 'Assets/B.glb']);
  });

  it('produces a manifest carrying export-three format + project metadata', () => {
    const project = buildMinimalProject();
    const result = exportProjectToThree(project, { exportedAt: 12345 });
    expect(result.manifest.format).toBe(EXPORT_THREE_FORMAT);
    expect(result.manifest.formatVersion).toBe(EXPORT_THREE_FORMAT_VERSION);
    expect(result.manifest.exportedAt).toBe(12345);
    expect(result.manifest.projectId).toBe('test-project');
    expect(result.manifest.projectName).toBe('Test Project');
    expect(result.manifest.activeSceneId).toBe('main');
    expect(result.manifest.sceneCount).toBe(1);
    expect(result.manifest.assetCount).toBe(1);
    expect(result.manifest.runtime).toBe('three-3d');
    expect(result.manifest.engine).toEqual({ name: 'PixlPlayground', version: '0.2.0' });
  });

  it('rejects an unexpected project format', () => {
    const project = buildMinimalProject({ format: 'unknown-format' as never });
    expect(() => exportProjectToThree(project)).toThrow(/unexpected project format/);
  });

  it('rejects a project whose active scene is missing', () => {
    const project = buildMinimalProject({ activeSceneId: 'nope' });
    expect(() => exportProjectToThree(project)).toThrow(/activeSceneId "nope" not found/);
  });

  it('rejects a project whose active scene is not 3d', () => {
    const project = buildMinimalProject({
      scenes: [{ id: 'main', name: 'Main', kind: '2d', rootObjects: [] }],
    });
    expect(() => exportProjectToThree(project)).toThrow(/kind="2d", expected "3d"/);
  });
});

// ---------------------------------------------------------------------------
// I/O wrapper
// ---------------------------------------------------------------------------

describe('runExportThree (IO, skipBundle)', () => {
  it('writes index.html, main.js, project.pixlproject.json, manifest.json into outDir', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-three-'));
    const projectPath = join(tmp, 'project.pixlproject.json');
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(projectPath, JSON.stringify(buildMinimalProject()), 'utf8'),
    );
    const outDir = join(tmp, 'out');
    const result = await runExportThree(projectPath, outDir, { skipBundle: true });

    expect(result.outDir).toBe(resolve(outDir));
    expect(result.fileCount).toBe(4); // index.html, project.pixlproject.json, manifest.json, main.js (no assets copied — fixture path doesn't exist on disk)
    expect(result.assetCount).toBe(0);
    expect(result.missingAssets).toHaveLength(1);
    expect(result.missingAssets[0]?.path).toBe('Assets/3D_Models/cube.glb');
    expect(result.bundleSizeBytes).toBeGreaterThan(0);

    // Verify files actually exist with non-trivial content.
    const indexStats = await stat(join(outDir, 'index.html'));
    expect(indexStats.size).toBeGreaterThan(100);
    const manifestRaw = await readFile(join(outDir, 'manifest.json'), 'utf8');
    expect(JSON.parse(manifestRaw).runtime).toBe('three-3d');
    const projectCopyRaw = await readFile(join(outDir, 'project.pixlproject.json'), 'utf8');
    expect(JSON.parse(projectCopyRaw).id).toBe('test-project');
  });

  it('copies an asset whose source exists on disk into <outDir>/<entry.path>', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-three-'));
    const fs = await import('node:fs/promises');

    // Stage an asset on disk under the project dir.
    const assetSrc = join(tmp, 'Assets', '3D_Models');
    await fs.mkdir(assetSrc, { recursive: true });
    await fs.writeFile(join(assetSrc, 'cube.glb'), 'PRETEND-GLB-BYTES');

    const project = buildMinimalProject();
    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(project), 'utf8');

    const outDir = join(tmp, 'out');
    const result = await runExportThree(projectPath, outDir, { skipBundle: true });

    expect(result.assetCount).toBe(1);
    expect(result.missingAssets).toEqual([]);
    const copied = await readFile(join(outDir, 'Assets', '3D_Models', 'cube.glb'), 'utf8');
    expect(copied).toBe('PRETEND-GLB-BYTES');
  });

  it('honors assetSearchPaths when the asset lives outside the project dir', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-three-'));
    const fs = await import('node:fs/promises');

    // Asset lives in a sibling root, not under the project dir.
    const externalRoot = join(tmp, 'portal-root');
    const assetExternal = join(externalRoot, 'public', 'assets', 'cube.glb');
    await fs.mkdir(join(externalRoot, 'public', 'assets'), { recursive: true });
    await fs.writeFile(assetExternal, 'EXTERNAL-GLB-BYTES');

    const project = buildMinimalProject({
      assets: {
        root: 'Assets',
        entries: [
          {
            id: 'asset-1',
            name: 'Cube',
            kind: 'model',
            path: 'Assets/cube.glb',
            url: 'public/assets/cube.glb',
          },
        ],
      },
    });
    const projectDir = join(tmp, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    const projectPath = join(projectDir, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(project), 'utf8');

    const outDir = join(tmp, 'out');
    const result = await runExportThree(projectPath, outDir, {
      skipBundle: true,
      assetSearchPaths: [externalRoot],
    });

    expect(result.assetCount).toBe(1);
    expect(result.missingAssets).toEqual([]);
    const copied = await readFile(join(outDir, 'Assets', 'cube.glb'), 'utf8');
    expect(copied).toBe('EXTERNAL-GLB-BYTES');
  });
});

// ---------------------------------------------------------------------------
// I/O wrapper + real esbuild bundle (slow; one happy-path coverage)
// ---------------------------------------------------------------------------

describe('runExportThree (IO, real esbuild bundle)', () => {
  it('bundles main.js with @pixlland/three-runtime + three + rapier embedded', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-three-bundle-'));
    const fs = await import('node:fs/promises');
    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(buildMinimalProject()), 'utf8');

    const outDir = join(tmp, 'out');
    const result = await runExportThree(projectPath, outDir);

    // Bundle should be substantial — three + rapier alone are several MB.
    expect(result.bundleSizeBytes).toBeGreaterThan(500_000);
    const bundle = await readFile(join(outDir, 'main.js'), 'utf8');
    // Sanity markers: three constants, rapier API surface, runtime entry.
    expect(bundle).toMatch(/PerspectiveCamera|three/i);
    expect(bundle).toMatch(/rapier|RAPIER/i);
    // _entry.js should have been cleaned up.
    await expect(stat(join(outDir, '_entry.js'))).rejects.toThrow();
  }, 30_000);
});

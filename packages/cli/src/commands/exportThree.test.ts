import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  exportProjectToThree,
  rewriteAssetUrlsInProject,
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
// Asset URL rewriting (pure)
// ---------------------------------------------------------------------------

describe('rewriteAssetUrlsInProject (pure)', () => {
  // Sample project mirroring the Harvest Rush-style mismatch: asset entries
  // declare both a `path` (where the exporter copies the binary) and a `url`
  // (where the binary lives in the parent monorepo). Components reference the
  // `url`; the runtime resolves them against <outDir> after stripping
  // `public/`, so the file lands wherever entry.path says. Without rewriting,
  // every fetch 404s.
  const buildProjectWithMismatch = (): PixlProjectShape => ({
    format: PIXL_PROJECT_FORMAT,
    version: PIXL_PROJECT_VERSION,
    id: 'p',
    name: 'P',
    activeSceneId: 'main',
    scenes: [
      {
        id: 'main',
        name: 'Main',
        kind: '3d',
        rootObjects: [
          {
            id: 'farm',
            name: 'Farm',
            type: 'group',
            components: [
              {
                id: 'farm-anim',
                type: 'pixl.animation',
                enabled: true,
                data: { modelUrl: 'public/assets/vendor/farm-pack/Farm.glb' },
              },
              {
                id: 'farm-logic',
                type: 'pixl.logic',
                enabled: true,
                data: {
                  customData: {
                    sourceAsset: 'public/assets/vendor/farm-pack/Farm.glb',
                    sourceNodeName: 'GroundTile',
                  },
                },
              },
            ],
          },
          {
            id: 'sfx',
            name: 'SFX',
            type: 'group',
            components: [
              {
                id: 'sfx-audio',
                type: 'pixl.audio',
                enabled: true,
                data: { url: 'public/assets/audio/click.ogg' },
              },
            ],
          },
        ],
      },
    ],
    assets: {
      root: 'Assets',
      entries: [
        {
          id: 'a-farm',
          name: 'Farm',
          kind: 'model',
          path: 'Assets/3D_Models/farm-pack/Farm.glb',
          url: 'public/assets/vendor/farm-pack/Farm.glb',
        },
        {
          id: 'a-click',
          name: 'Click',
          kind: 'audio',
          path: 'Assets/Audio/click.ogg',
          url: 'public/assets/audio/click.ogg',
        },
      ],
    },
  });

  it('returns rewriteCount=0 and the same project ref when no asset entries are declared', () => {
    const project: PixlProjectShape = {
      format: PIXL_PROJECT_FORMAT,
      version: PIXL_PROJECT_VERSION,
      id: 'p',
      name: 'P',
      activeSceneId: 'main',
      scenes: [{ id: 'main', name: 'Main', kind: '3d', rootObjects: [] }],
    };
    const out = rewriteAssetUrlsInProject(project);
    expect(out.rewriteCount).toBe(0);
    expect(out.project).toBe(project);
  });

  it('rewrites modelUrl, customData.sourceAsset, and url to point at entry.path', () => {
    const project = buildProjectWithMismatch();
    const out = rewriteAssetUrlsInProject(project);

    // Three rewrites: pixl.animation.modelUrl, pixl.logic.customData.sourceAsset, pixl.audio.url.
    expect(out.rewriteCount).toBe(3);

    const farmObject = out.project.scenes[0]!.rootObjects[0]!;
    const farmAnim = farmObject.components!.find((c) => c.id === 'farm-anim')!;
    expect(farmAnim.data!.modelUrl).toBe('Assets/3D_Models/farm-pack/Farm.glb');

    const farmLogic = farmObject.components!.find((c) => c.id === 'farm-logic')!;
    const customData = farmLogic.data!.customData as Record<string, unknown>;
    expect(customData.sourceAsset).toBe('Assets/3D_Models/farm-pack/Farm.glb');
    expect(customData.sourceNodeName).toBe('GroundTile'); // unrelated field preserved

    const sfxObject = out.project.scenes[0]!.rootObjects[1]!;
    const sfxAudio = sfxObject.components!.find((c) => c.id === 'sfx-audio')!;
    expect(sfxAudio.data!.url).toBe('Assets/Audio/click.ogg');
  });

  it('does not mutate the input project document', () => {
    const project = buildProjectWithMismatch();
    const before = JSON.stringify(project);
    rewriteAssetUrlsInProject(project);
    const after = JSON.stringify(project);
    expect(after).toBe(before);
  });

  it('matches by raw URL when public/ prefix is absent (normalized form already)', () => {
    const project: PixlProjectShape = {
      format: PIXL_PROJECT_FORMAT,
      version: PIXL_PROJECT_VERSION,
      id: 'p',
      name: 'P',
      activeSceneId: 'main',
      scenes: [
        {
          id: 'main',
          name: 'Main',
          kind: '3d',
          rootObjects: [
            {
              id: 'o',
              name: 'O',
              type: 'group',
              components: [
                {
                  id: 'mesh',
                  type: 'pixl.mesh',
                  enabled: true,
                  // Same URL as entry.url but without `public/` — the runtime
                  // would normalize entry.url to this form, so the lookup
                  // must match without the prefix too.
                  data: { modelUrl: 'assets/vendor/farm-pack/Farm.glb' },
                },
              ],
            },
          ],
        },
      ],
      assets: {
        root: 'Assets',
        entries: [
          {
            id: 'a',
            name: 'A',
            kind: 'model',
            path: 'Assets/Farm.glb',
            url: 'public/assets/vendor/farm-pack/Farm.glb',
          },
        ],
      },
    };
    const out = rewriteAssetUrlsInProject(project);
    expect(out.rewriteCount).toBe(1);
    const mesh = out.project.scenes[0]!.rootObjects[0]!.components![0]!;
    expect(mesh.data!.modelUrl).toBe('Assets/Farm.glb');
  });

  it('leaves URLs alone when no asset entry matches', () => {
    const project: PixlProjectShape = {
      format: PIXL_PROJECT_FORMAT,
      version: PIXL_PROJECT_VERSION,
      id: 'p',
      name: 'P',
      activeSceneId: 'main',
      scenes: [
        {
          id: 'main',
          name: 'Main',
          kind: '3d',
          rootObjects: [
            {
              id: 'o',
              name: 'O',
              type: 'group',
              components: [
                {
                  id: 'mesh',
                  type: 'pixl.mesh',
                  enabled: true,
                  data: { modelUrl: 'https://cdn.example.com/something.glb' },
                },
              ],
            },
          ],
        },
      ],
      assets: {
        root: 'Assets',
        entries: [
          { id: 'a', name: 'A', kind: 'model', path: 'Assets/Farm.glb' /* no url */ },
        ],
      },
    };
    const out = rewriteAssetUrlsInProject(project);
    expect(out.rewriteCount).toBe(0);
    const mesh = out.project.scenes[0]!.rootObjects[0]!.components![0]!;
    expect(mesh.data!.modelUrl).toBe('https://cdn.example.com/something.glb');
  });

  it('skips a no-op rewrite when modelUrl already equals entry.path', () => {
    const project: PixlProjectShape = {
      format: PIXL_PROJECT_FORMAT,
      version: PIXL_PROJECT_VERSION,
      id: 'p',
      name: 'P',
      activeSceneId: 'main',
      scenes: [
        {
          id: 'main',
          name: 'Main',
          kind: '3d',
          rootObjects: [
            {
              id: 'o',
              name: 'O',
              type: 'group',
              components: [
                {
                  id: 'mesh',
                  type: 'pixl.mesh',
                  enabled: true,
                  data: { modelUrl: 'Assets/Farm.glb' }, // already canonical
                },
              ],
            },
          ],
        },
      ],
      assets: {
        root: 'Assets',
        entries: [{ id: 'a', name: 'A', kind: 'model', path: 'Assets/Farm.glb' }],
      },
    };
    const out = rewriteAssetUrlsInProject(project);
    expect(out.rewriteCount).toBe(0);
    expect(out.project).toBe(project); // structural sharing — no copy when nothing changed
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

  it('writes a rewritten project.pixlproject.json so component URLs match entry.path', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-three-'));
    const fs = await import('node:fs/promises');

    const project: PixlProjectShape = {
      ...buildMinimalProject(),
      scenes: [
        {
          id: 'main',
          name: 'Main',
          kind: '3d',
          rootObjects: [
            {
              id: 'farm',
              name: 'Farm',
              type: 'group',
              components: [
                {
                  id: 'farm-mesh',
                  type: 'pixl.mesh',
                  enabled: true,
                  data: { modelUrl: 'public/assets/vendor/Farm.glb' },
                },
              ],
            },
          ],
        },
      ],
      assets: {
        root: 'Assets',
        entries: [
          {
            id: 'a',
            name: 'A',
            kind: 'model',
            path: 'Assets/3D_Models/Farm.glb',
            url: 'public/assets/vendor/Farm.glb',
          },
        ],
      },
    };
    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(project), 'utf8');

    const outDir = join(tmp, 'out');
    const result = await runExportThree(projectPath, outDir, { skipBundle: true });

    expect(result.rewriteCount).toBe(1);

    // Disk version: modelUrl rewritten to canonical entry.path.
    const written = JSON.parse(
      await readFile(join(outDir, 'project.pixlproject.json'), 'utf8'),
    ) as PixlProjectShape;
    const writtenMesh = written.scenes[0]!.rootObjects[0]!.components![0]!;
    expect(writtenMesh.data!.modelUrl).toBe('Assets/3D_Models/Farm.glb');

    // Source project on disk unchanged — only the COPIED doc was rewritten.
    const sourceAfter = JSON.parse(await readFile(projectPath, 'utf8')) as PixlProjectShape;
    const sourceMesh = sourceAfter.scenes[0]!.rootObjects[0]!.components![0]!;
    expect(sourceMesh.data!.modelUrl).toBe('public/assets/vendor/Farm.glb');
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

describe('runExportThree (IO, real Vite bundle)', () => {
  it('produces a Vite-bundled site with @pixlland/three-runtime + three + rapier embedded', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-three-bundle-'));
    const fs = await import('node:fs/promises');
    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(buildMinimalProject()), 'utf8');

    const outDir = join(tmp, 'out');
    const result = await runExportThree(projectPath, outDir);

    // Bundle should be substantial — three + rapier alone are several MB.
    expect(result.bundleSizeBytes).toBeGreaterThan(500_000);

    // Vite emits chunks under <outDir>/assets/. Collect them and look for
    // sanity markers across the whole set (rollup may split them).
    const assetsDir = join(outDir, 'assets');
    const chunkFiles = (await readdir(assetsDir)).filter((f) => f.endsWith('.js'));
    expect(chunkFiles.length).toBeGreaterThan(0);
    const combined = (
      await Promise.all(chunkFiles.map((f) => readFile(join(assetsDir, f), 'utf8')))
    ).join('\n');
    expect(combined).toMatch(/PerspectiveCamera|three/i);
    expect(combined).toMatch(/rapier|RAPIER/i);

    // index.html should reference the hashed chunk, not the raw './main.js'.
    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    expect(html).toMatch(/<script[^>]+src=["']\.\/assets\/[\w-]+\.js["']/);
    expect(html).not.toContain('src="./main.js"');

    // Hand-written artifacts must survive the bundler (emptyOutDir: false).
    await expect(stat(join(outDir, 'project.pixlproject.json'))).resolves.toBeTruthy();
    await expect(stat(join(outDir, 'manifest.json'))).resolves.toBeTruthy();
  }, 60_000);

  it('emits sourcemaps and an unminified bundle when --sourcemap + --no-minify are set', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'pixl-export-three-flags-'));
    const fs = await import('node:fs/promises');
    const projectPath = join(tmp, 'project.pixlproject.json');
    await fs.writeFile(projectPath, JSON.stringify(buildMinimalProject()), 'utf8');

    const outDir = join(tmp, 'out');
    await runExportThree(projectPath, outDir, { sourcemap: true, minify: false });

    const assetsDir = join(outDir, 'assets');
    const dirEntries = await readdir(assetsDir);

    // Sourcemap: Vite emits at least one *.js.map alongside the bundle chunks.
    const mapFiles = dirEntries.filter((f) => f.endsWith('.js.map'));
    expect(mapFiles.length).toBeGreaterThan(0);

    // No-minify: the bundle keeps original whitespace/newlines from three +
    // three-runtime source, which the minifier would otherwise collapse to a
    // near-single line. Easy structural signal that doesn't depend on which
    // identifiers survive name-mangling.
    const jsFiles = dirEntries.filter((f) => f.endsWith('.js'));
    const combined = (
      await Promise.all(jsFiles.map((f) => readFile(join(assetsDir, f), 'utf8')))
    ).join('\n');
    const newlineCount = (combined.match(/\n/g) ?? []).length;
    expect(newlineCount).toBeGreaterThan(1000);
  }, 60_000);
});

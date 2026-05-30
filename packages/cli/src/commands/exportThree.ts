// pixl-engine export-three — emits a standalone web bundle that runs a
// PixlProjectDocument via @pixlland/three-runtime + Three.js + Rapier.
//
// Two layers:
//   - exportProjectToThree(project, opts): pure function. Generates HTML +
//     main.js source + manifest + asset path list. No filesystem I/O. Easy
//     to unit-test with vitest.
//   - runExportThree(projectPath, outDir, opts): I/O wrapper. Reads project
//     doc, copies assets from the project source dir to <outDir>/Assets/,
//     writes the generated files, and invokes vite.build programmatically
//     (same bundler used by apps/studio, mirroring the Phaser/PlayCanvas
//     convention — see HANDOFF-MAC.md "Review pass session 4").
//
// The output directory is a fully-static, drop-anywhere site:
//   <outDir>/
//     index.html               -- rewritten by Vite with hashed script ref
//     assets/index-<hash>.js   -- main bundle (~3.5 MB, embeds three-runtime + three + rapier)
//     assets/<chunk>-<hash>.js -- additional rollup code-split chunks (small projects: usually none)
//     project.pixlproject.json
//     manifest.json
//     Assets/                  -- copied verbatim from <projectDir>/<assets.root>/
//       3D_Models/...
//       Textures/...
//
// Companion commands (planned): export-phaser (2D, same vite-based pipeline),
// export-pixlland (Pixlland portal-ready archive).

import { mkdir, writeFile, readFile, copyFile, stat, rm, mkdtemp, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PixlProjectShape, PixlSceneObjectShape } from '../schema.js';

// ---------------------------------------------------------------------------
// Asset URL rewriting
// ---------------------------------------------------------------------------
//
// The runtime (packages/three-runtime/src/adapter/pixlSchemaAdapter.ts) reads
// URLs from component.data fields like `modelUrl`, `assetPath`, `url` and
// `customData.sourceAsset`, then runs them through `normalizeAssetPath` —
// which strips a leading `public/`. So a `modelUrl` of
// "public/assets/vendor/farm-pack/Farm.glb" becomes "assets/vendor/farm-pack/Farm.glb"
// and is fetched relative to <outDir>.
//
// But the exporter copies asset binaries to `<outDir>/<entry.path>` — where
// `entry.path` is the project's canonical asset folder layout (e.g.
// "Assets/3D_Models/farm-pack/Farm.glb"). The two paths don't match, so the
// runtime gets 404s on every binary.
//
// Fix: rewrite the URL fields in the COPIED project document so they point
// at `entry.path` directly. We mirror the runtime's `normalizeAssetPath` to
// handle the `public/` prefix correctly when matching.

// Mirror of packages/three-runtime/src/adapter/pixlSchemaAdapter.ts —
// keep in sync. Stripping `public/` lets us match URLs the runtime would
// itself normalize before fetching.
const normalizeAssetPath = (value: string): string => value.replace(/^public\//, '');

// URL-bearing fields the runtime reads from `component.data`. See
// pixlSchemaAdapter.ts (`mapComponent`) for the canonical list.
const COMPONENT_URL_FIELDS = ['modelUrl', 'assetPath', 'url'] as const;

interface AssetLookup {
  /** Map from any spelling of an asset URL to its canonical `entry.path`. */
  byUrl: Map<string, string>;
}

const buildAssetLookup = (project: PixlProjectShape): AssetLookup => {
  const byUrl = new Map<string, string>();
  const entries = project.assets?.entries ?? [];
  for (const entry of entries) {
    if (!entry.path) continue;
    const dest = entry.path;
    // Index both the raw url/path and their normalized forms so we match
    // regardless of whether the consumer wrote `public/...` or the stripped
    // variant. Last-write-wins on collisions is fine — all spellings of one
    // asset must point at the same dest.
    if (entry.url) {
      byUrl.set(entry.url, dest);
      byUrl.set(normalizeAssetPath(entry.url), dest);
    }
    byUrl.set(entry.path, dest);
    byUrl.set(normalizeAssetPath(entry.path), dest);
  }
  return { byUrl };
};

const rewriteUrlValue = (value: unknown, lookup: AssetLookup): { value: unknown; rewritten: boolean } => {
  if (typeof value !== 'string') return { value, rewritten: false };
  const dest = lookup.byUrl.get(value) ?? lookup.byUrl.get(normalizeAssetPath(value));
  if (!dest || dest === value) return { value, rewritten: false };
  return { value: dest, rewritten: true };
};

const rewriteComponentData = (
  data: Record<string, unknown>,
  lookup: AssetLookup,
  counter: { count: number },
): Record<string, unknown> => {
  let changed = false;
  const out: Record<string, unknown> = { ...data };
  for (const field of COMPONENT_URL_FIELDS) {
    const result = rewriteUrlValue(out[field], lookup);
    if (result.rewritten) {
      out[field] = result.value;
      counter.count += 1;
      changed = true;
    }
  }
  // pixl.logic.customData.sourceAsset — the GLTF-node pattern used by
  // Harvest Rush-style projects. See `synthesizeGltfNodeComponents` in
  // pixlSchemaAdapter.ts.
  const customData = out.customData;
  if (customData && typeof customData === 'object' && !Array.isArray(customData)) {
    const cd = customData as Record<string, unknown>;
    const result = rewriteUrlValue(cd.sourceAsset, lookup);
    if (result.rewritten) {
      out.customData = { ...cd, sourceAsset: result.value };
      counter.count += 1;
      changed = true;
    }
  }
  return changed ? out : data;
};

const rewriteObject = (
  object: PixlSceneObjectShape,
  lookup: AssetLookup,
  counter: { count: number },
): PixlSceneObjectShape => {
  let changed = false;
  let components = object.components;
  if (components) {
    const next = components.map((comp) => {
      const newData = rewriteComponentData(comp.data, lookup, counter);
      return newData === comp.data ? comp : { ...comp, data: newData };
    });
    if (next.some((c, i) => c !== components![i])) {
      components = next;
      changed = true;
    }
  }
  // object.data is optional per schema — only walk it when present.
  const data = object.data ? rewriteComponentData(object.data, lookup, counter) : object.data;
  if (data !== object.data) changed = true;

  let children = object.children;
  if (children) {
    const nextChildren = children.map((child) => rewriteObject(child, lookup, counter));
    if (nextChildren.some((child, index) => child !== children![index])) {
      children = nextChildren;
      changed = true;
    }
  }

  return changed ? { ...object, components, data, children } : object;
};

/**
 * Rewrite component-data URL fields in a project document so every reference
 * points at the canonical `entry.path` instead of `entry.url`. Pure: returns
 * a new project doc (structurally shared where nothing changed) and a count
 * of fields touched. Safe to call on projects with no asset entries — it's a
 * no-op in that case.
 */
export const rewriteAssetUrlsInProject = (
  project: PixlProjectShape,
): { project: PixlProjectShape; rewriteCount: number } => {
  const lookup = buildAssetLookup(project);
  if (lookup.byUrl.size === 0) return { project, rewriteCount: 0 };
  const counter = { count: 0 };
  const newScenes = project.scenes.map((scene) => {
    const newRoots = scene.rootObjects.map((obj) => rewriteObject(obj, lookup, counter));
    if (newRoots.some((r, i) => r !== scene.rootObjects[i])) {
      return { ...scene, rootObjects: newRoots };
    }
    return scene;
  });
  if (newScenes.some((s, i) => s !== project.scenes[i])) {
    return { project: { ...project, scenes: newScenes }, rewriteCount: counter.count };
  }
  return { project, rewriteCount: counter.count };
};

// ---------------------------------------------------------------------------
// Public API (pure)
// ---------------------------------------------------------------------------

export const EXPORT_THREE_FORMAT = 'pixlplayground-export-three' as const;
export const EXPORT_THREE_FORMAT_VERSION = 1 as const;

export interface ExportThreeOptions {
  /**
   * AssetStore base path written into the generated main.js — passed as the
   * `source` argument to `new Game(source)`. Defaults to `.` so the runtime
   * resolves assets relative to wherever index.html is served from.
   */
  assetSourceBase?: string;
  /** `<title>` text. Defaults to `project.name`. */
  title?: string;
  /** CSS background of the host page. Defaults to `#000`. */
  pageBackground?: string;
  /**
   * Deterministic timestamp for the manifest. Tests pin this; production
   * leaves it undefined and the runner stamps Date.now().
   */
  exportedAt?: number;
}

export interface ExportThreeManifest {
  format: typeof EXPORT_THREE_FORMAT;
  formatVersion: typeof EXPORT_THREE_FORMAT_VERSION;
  exportedAt: number;
  projectId: string;
  projectName: string;
  activeSceneId: string;
  sceneCount: number;
  assetCount: number;
  engine: { name?: string; version?: string } | undefined;
  runtime: 'three-3d';
}

export interface ExportThreeResult {
  indexHtml: string;
  /** Pre-bundle main.js source. runExportThree pipes this through Vite. */
  mainJsSource: string;
  manifest: ExportThreeManifest;
  /**
   * Asset paths declared in `project.assets.entries[].path`. The runner
   * copies each one from <projectDir>/<path> into <outDir>/<path>. Order is
   * preserved from the project document.
   */
  assetPaths: string[];
  /**
   * Project document with component URL fields rewritten to point at the
   * canonical `entry.path` of each asset (instead of `entry.url`). The
   * runner writes THIS doc to `<outDir>/project.pixlproject.json`, not the
   * raw input — otherwise the runtime would 404 on every binary that was
   * authored with a `public/...` URL.
   */
  rewrittenProject: PixlProjectShape;
  /** Number of URL fields rewritten. 0 if the project had no assets or all URLs already matched their entry.path. */
  rewriteCount: number;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildIndexHtml = (title: string, pageBackground: string): string => {
  const safeTitle = escapeHtml(title);
  const safeBg = escapeHtml(pageBackground);
  // Keep the template literal-free; just embed values into a plain string.
  // Tabs are intentionally NOT used so editor diffs stay clean.
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${safeTitle}</title>`,
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<style>',
    `html,body{margin:0;padding:0;height:100%;background:${safeBg};overflow:hidden;font-family:system-ui,sans-serif;color:#eee}`,
    'canvas{display:block;width:100vw!important;height:100vh!important}',
    '#error{position:fixed;top:0;left:0;right:0;padding:12px 16px;background:#3a0a0a;color:#fca5a5;font:13px/1.4 ui-monospace,monospace;white-space:pre-wrap;display:none}',
    '#error.show{display:block}',
    '</style>',
    '</head>',
    '<body>',
    '<div id="error"></div>',
    '<script type="module" src="./main.js"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
};

const buildMainJsSource = (assetSourceBase: string): string => {
  const safeBase = JSON.stringify(assetSourceBase);
  // The runtime asset cache is primed by Game.loadFromPixlProject — see
  // packages/three-runtime/src/Game.ts. AssetSource is still needed for
  // binary assets (GLB / textures / audio).
  //
  // three-runtime's Game class is canvas-agnostic — it creates a
  // THREE.WebGLRenderer but does NOT attach the canvas to the DOM (the
  // editor mounts it inside a React component). The standalone bundle has
  // to do the attach + resize wiring itself; otherwise the renderer paints
  // into an orphan canvas no one ever sees.
  return [
    '// Generated by pixl-engine export-three. Do not edit by hand.',
    "import { Game } from '@pixlland/three-runtime';",
    '',
    'const showError = (message) => {',
    "  const el = document.getElementById('error');",
    '  if (el) { el.textContent = message; el.classList.add(\'show\'); }',
    "  console.error('[pixl-export-three]', message);",
    '};',
    '',
    'const attachCanvas = (game) => {',
    '  const tr = game?.renderer?.threeJSRenderer;',
    '  const canvas = tr?.domElement;',
    '  if (!canvas) return;',
    '  if (!document.body.contains(canvas)) document.body.appendChild(canvas);',
    '  const resize = () => {',
    '    game.renderer.setSize(window.innerWidth, window.innerHeight);',
    '  };',
    '  resize();',
    "  window.addEventListener('resize', resize);",
    '};',
    '',
    'const rendererOptions = {};',
    '',
    '(async () => {',
    '  try {',
    "    const resp = await fetch('./project.pixlproject.json');",
    "    if (!resp.ok) throw new Error('Failed to fetch project.pixlproject.json: ' + resp.status);",
    '    const project = await resp.json();',
    `    const game = new Game(${safeBase}, { rendererOptions });`,
    '    await game.loadFromPixlProject(project);',
    '    await game.play();',
    '    attachCanvas(game);',
    "    window.__pixlGame = game; // expose for debugging",
    '  } catch (err) {',
    '    showError(err && err.stack ? err.stack : String(err));',
    '  }',
    '})();',
    '',
  ].join('\n');
};

// ---------------------------------------------------------------------------
// Pure exporter
// ---------------------------------------------------------------------------

export const exportProjectToThree = (
  project: PixlProjectShape,
  options: ExportThreeOptions = {},
): ExportThreeResult => {
  // Schema sanity — fail loudly instead of producing a broken bundle.
  if (project.format !== 'pixlplayground-project') {
    throw new Error(
      `exportProjectToThree: unexpected project format "${project.format}". Expected "pixlplayground-project".`,
    );
  }
  const activeScene = project.scenes.find((s) => s.id === project.activeSceneId);
  if (!activeScene) {
    throw new Error(
      `exportProjectToThree: activeSceneId "${project.activeSceneId}" not found in project.scenes.`,
    );
  }
  if (activeScene.kind !== '3d') {
    throw new Error(
      `exportProjectToThree: active scene "${activeScene.id}" is kind="${activeScene.kind}", expected "3d". Use export-phaser for 2D projects.`,
    );
  }

  const assetSourceBase = options.assetSourceBase ?? '.';
  const title = options.title ?? project.name;
  const pageBackground = options.pageBackground ?? '#000';

  const indexHtml = buildIndexHtml(title, pageBackground);
  const mainJsSource = buildMainJsSource(assetSourceBase);

  const assetEntries = project.assets?.entries ?? [];
  // Dedupe by path. Project docs can legally have multiple entries pointing
  // at the same file (e.g. shared GLB referenced by several objects).
  const assetPaths = Array.from(
    new Set(assetEntries.map((e) => e.path).filter((p): p is string => typeof p === 'string' && p.length > 0)),
  );

  // Rewrite component URL fields to point at entry.path. See the long block
  // comment near `rewriteAssetUrlsInProject` for why this is necessary.
  const { project: rewrittenProject, rewriteCount } = rewriteAssetUrlsInProject(project);

  const manifest: ExportThreeManifest = {
    format: EXPORT_THREE_FORMAT,
    formatVersion: EXPORT_THREE_FORMAT_VERSION,
    exportedAt: options.exportedAt ?? 0,
    projectId: project.id,
    projectName: project.name,
    activeSceneId: project.activeSceneId,
    sceneCount: project.scenes.length,
    assetCount: assetPaths.length,
    engine: project.engine
      ? { name: project.engine.name, version: project.engine.version }
      : undefined,
    runtime: 'three-3d',
  };

  return { indexHtml, mainJsSource, manifest, assetPaths, rewrittenProject, rewriteCount };
};

// ---------------------------------------------------------------------------
// I/O wrapper
// ---------------------------------------------------------------------------

export interface RunExportThreeOptions extends ExportThreeOptions {
  /**
   * Additional directories to search when resolving an asset entry's
   * `url`/`path`. The runner tries `<searchPath>/<entry.url>` then
   * `<searchPath>/<entry.path>`. Defaults to `[projectDir]`. In a multi-repo
   * layout (e.g. asset binaries served from a portal's `public/`), pass the
   * portal root here.
   */
  assetSearchPaths?: string[];
  /**
   * Skip the Vite bundling step. Emits the raw main.js source directly into
   * `<outDir>/main.js` instead of running `vite.build`. Tests use this to
   * avoid the slow bundler in the unit suite; consumers can use it to bundle
   * with their own toolchain.
   */
  skipBundle?: boolean;
  /**
   * Emit JS sourcemaps alongside the bundled chunks. Defaults to false (no
   * sourcemap). Set true for dev/debug builds where you want stack traces
   * pointing back to the original three-runtime source.
   */
  sourcemap?: boolean;
  /**
   * Override Vite's default minifier. Defaults to undefined — let Vite pick
   * (terser/esbuild minify in production builds). Set false to emit an
   * unminified bundle for inspection. There's no "true" path beyond the
   * default; bring your own minifier setting via a custom vite.config if
   * you need finer control.
   */
  minify?: boolean;
  /**
   * Override the directory used to anchor module resolution (Vite reads
   * `@pixlland/three-runtime` from `<cliPackageDir>/node_modules/...`).
   * Defaults to this package's directory, resolved via import.meta.url.
   * Tests inject this to bundle from a controlled location.
   */
  cliPackageDir?: string;
}

export interface RunExportThreeResult {
  outDir: string;
  fileCount: number;
  assetCount: number;
  /**
   * Asset entries whose `url` and `path` could not be located on disk. Empty
   * in the happy path. Non-empty does NOT fail the export — the bundle still
   * works for whatever code paths don't touch the missing assets.
   */
  missingAssets: Array<{ id: string; path: string; url?: string }>;
  bundleSizeBytes: number;
  /**
   * Count of URL fields (modelUrl, assetPath, url, customData.sourceAsset)
   * rewritten to point at their asset entry's canonical path. 0 means every
   * URL already matched its entry.path (or the project had no assets).
   */
  rewriteCount: number;
}

const fileExists = async (path: string): Promise<boolean> => {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
};

const defaultCliPackageDir = (): string => {
  // __filename in compiled form: <cliDir>/dist/commands/exportThree.js
  // __filename in source/vitest:  <cliDir>/src/commands/exportThree.ts
  // Either way, up two levels from the file's directory is the package dir.
  const here = fileURLToPath(import.meta.url);
  return resolve(dirname(here), '..', '..');
};

/**
 * Copy an asset entry from its source location to `<outDir>/<entry.path>`.
 * Returns true if copied, false if the source could not be located on disk.
 *
 * Pixl projects sometimes encode asset locations with a `public/` prefix
 * (Vite-style convention: files in `public/` are served from root). The
 * runtime strips that prefix when fetching; the file-finder mirrors the same
 * normalization to locate the binary on disk. Both raw and normalized forms
 * are tried for each (base, entry.url|path) combination.
 */
const copyAssetEntry = async (
  entry: { id: string; path: string; url?: string },
  projectDir: string,
  outDir: string,
  searchPaths: string[],
): Promise<boolean> => {
  const candidates: string[] = [];
  const pushVariants = (base: string, ref: string): void => {
    candidates.push(resolve(base, ref));
    const normalized = normalizeAssetPath(ref);
    if (normalized !== ref) candidates.push(resolve(base, normalized));
  };
  for (const base of [projectDir, ...searchPaths]) {
    if (entry.url) pushVariants(base, entry.url);
    if (entry.path) pushVariants(base, entry.path);
  }
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      const dest = resolve(outDir, entry.path);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(candidate, dest);
      return true;
    }
  }
  return false;
};

// Recursively sum bytes of every .js file under `dir`. Used to report the
// total bundle size when Vite splits the output into multiple chunks.
const sumJsBytesRecursive = async (dir: string): Promise<number> => {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await sumJsBytesRecursive(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      total += (await stat(full)).size;
    }
  }
  return total;
};

export const runExportThree = async (
  projectPath: string,
  outDir: string,
  options: RunExportThreeOptions = {},
): Promise<RunExportThreeResult> => {
  const absProject = resolve(process.cwd(), projectPath);
  const absOut = resolve(process.cwd(), outDir);
  const projectDir = dirname(absProject);

  const raw = await readFile(absProject, 'utf8');
  const project = JSON.parse(raw) as PixlProjectShape;

  // Stamp manifest with real time at write boundary (the pure exporter
  // accepts an override for deterministic tests).
  const exportedAt = options.exportedAt ?? Date.now();
  const result = exportProjectToThree(project, { ...options, exportedAt });

  await mkdir(absOut, { recursive: true });

  // Write the non-bundle artifacts straight into absOut. Vite's build is
  // configured with emptyOutDir: false so these survive the bundler pass.
  // NOTE: we write `result.rewrittenProject`, not the raw input — the runtime
  // resolves component URLs against <outDir>, and the rewrite makes those
  // URLs match the entry.path locations the exporter actually copies to.
  await writeFile(
    resolve(absOut, 'project.pixlproject.json'),
    `${JSON.stringify(result.rewrittenProject, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    resolve(absOut, 'manifest.json'),
    `${JSON.stringify(result.manifest, null, 2)}\n`,
    'utf8',
  );

  // Copy assets into a staging directory that becomes Vite's publicDir.
  // Vite then copies everything in publicDir verbatim into absOut, preserving
  // sub-paths. This means `<entry.path>` (e.g. "Assets/3D_Models/Farm.glb")
  // lands at "<absOut>/Assets/3D_Models/Farm.glb".
  //
  // When skipBundle is set we skip both Vite and publicDir copying; assets
  // are copied directly into absOut instead (matching the previous behavior).
  const assetEntries = project.assets?.entries ?? [];
  const missingAssets: RunExportThreeResult['missingAssets'] = [];
  let copiedCount = 0;
  const searchPaths = options.assetSearchPaths ?? [];

  if (options.skipBundle) {
    // skipBundle path: no Vite. Copy assets directly into absOut, emit the
    // raw main.js source straight into absOut/main.js.
    for (const entry of assetEntries) {
      if (!entry.path) continue;
      const ok = await copyAssetEntry(entry, projectDir, absOut, searchPaths);
      if (ok) copiedCount += 1;
      else missingAssets.push({ id: entry.id, path: entry.path, url: entry.url });
    }
    await writeFile(resolve(absOut, 'index.html'), result.indexHtml, 'utf8');
    await writeFile(resolve(absOut, 'main.js'), result.mainJsSource, 'utf8');
    const bundleSizeBytes = Buffer.byteLength(result.mainJsSource, 'utf8');
    return {
      outDir: absOut,
      fileCount: 4 + copiedCount, // index.html + project.pixlproject.json + manifest.json + main.js + assets
      assetCount: copiedCount,
      missingAssets,
      bundleSizeBytes,
      rewriteCount: result.rewriteCount,
    };
  }

  const cliPackageDir = options.cliPackageDir ?? defaultCliPackageDir();
  // Use a tmp dir *inside* the CLI package, not os.tmpdir(). On macOS the
  // system tmp dir is `/private/var/folders/...` which is a symlink target;
  // Vite/Rollup's vite:build-html plugin breaks when relativizing such paths
  // against process.cwd(), emitting bogus "../../../../private/..." chunks.
  // Anchoring under cliPackageDir/.tmp/ avoids that entirely.
  const tmpBase = join(cliPackageDir, '.tmp');
  await mkdir(tmpBase, { recursive: true });
  const tmpRoot = await mkdtemp(join(tmpBase, 'export-three-root-'));
  const tmpPublic = await mkdtemp(join(tmpBase, 'export-three-public-'));
  let bundleSizeBytes = 0;

  try {
    // Write entry files Vite will pick up.
    await writeFile(resolve(tmpRoot, 'index.html'), result.indexHtml, 'utf8');
    await writeFile(resolve(tmpRoot, 'main.js'), result.mainJsSource, 'utf8');

    // Stage assets in publicDir, preserving entry.path subpaths.
    for (const entry of assetEntries) {
      if (!entry.path) continue;
      const ok = await copyAssetEntry(entry, projectDir, tmpPublic, searchPaths);
      if (ok) copiedCount += 1;
      else missingAssets.push({ id: entry.id, path: entry.path, url: entry.url });
    }

    // Pin @pixlland/three-runtime to its real `dist/index.js` so Vite doesn't
    // need to walk node_modules from tmpRoot (which has none of its own). The
    // symlink target itself owns three + rapier3d-compat in its node_modules,
    // so transitive resolution still works from the aliased path.
    const threeRuntimeEntry = resolve(
      cliPackageDir,
      'node_modules',
      '@pixlland',
      'three-runtime',
      'dist',
      'index.js',
    );

    const vite = await import('vite');
    await vite.build({
      configFile: false,
      root: tmpRoot,
      publicDir: tmpPublic,
      logLevel: 'error',
      // Emit `./assets/...` relative refs in index.html so the bundle is
      // portable to any hosting root (file://, itch.io, GitHub Pages, a
      // games sub-path, etc.).
      base: './',
      resolve: {
        alias: {
          '@pixlland/three-runtime': threeRuntimeEntry,
        },
      },
      build: {
        outDir: absOut,
        emptyOutDir: false,
        target: 'es2022',
        sourcemap: options.sourcemap === true,
        // Only override Vite's default minifier when `minify: false` is
        // explicitly requested — passing `undefined` falls through to Vite's
        // production default (esbuild minify). Boolean true is rejected as
        // an invalid value by Vite's typings, so we leave that case out.
        ...(options.minify === false ? { minify: false as const } : {}),
        // Vite auto-discovers <root>/index.html as the entry. No explicit
        // rollupOptions.input needed — and passing an absolute path here
        // breaks when tmpRoot and process.cwd() live in different filesystem
        // roots (e.g. /private/var/folders/... vs /Users/...).
      },
    });

    bundleSizeBytes = await sumJsBytesRecursive(resolve(absOut, 'assets'));
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
    await rm(tmpPublic, { recursive: true, force: true });
  }

  // fileCount: 3 hand-written (project.pixlproject.json + manifest.json +
  // index.html-from-Vite) + Vite's bundle chunks + copied assets. We don't
  // try to enumerate chunks here — bundleSizeBytes is the canonical signal.
  const fileCount = 3 + copiedCount;

  return {
    outDir: absOut,
    fileCount,
    assetCount: copiedCount,
    missingAssets,
    bundleSizeBytes,
    rewriteCount: result.rewriteCount,
  };
};

export const printExportThreeResult = (result: RunExportThreeResult): void => {
  // eslint-disable-next-line no-console
  console.log('pixl-engine export-three');
  console.log(`  out:           ${result.outDir}`);
  console.log(`  files:         ${result.fileCount}`);
  console.log(`  assets copied: ${result.assetCount}`);
  console.log(`  bundle bytes:  ${result.bundleSizeBytes.toLocaleString()}`);
  console.log(`  url rewrites:  ${result.rewriteCount}`);
  if (result.missingAssets.length > 0) {
    console.log(`  missing:       ${result.missingAssets.length}`);
    for (const m of result.missingAssets.slice(0, 5)) {
      console.log(`    - ${m.path}${m.url ? ` (url: ${m.url})` : ''}`);
    }
    if (result.missingAssets.length > 5) {
      console.log(`    ... +${result.missingAssets.length - 5} more`);
    }
  }
};

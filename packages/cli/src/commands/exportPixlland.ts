// pixl-engine export-pixlland - unified Pixlland upload package target.
//
// This is the "Build" button shape for agents and future UI: take a
// PixlProjectDocument, choose the correct runtime exporter from scene.kind,
// then package the static web output into a single hash-verified archive.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { packProject, type PixlPackageManifest } from '@pixlland/engine-core';
import {
  readProjectFolder,
  writeBytesToFile,
} from '@pixlland/engine-core/node';

import type { PixlProjectShape, PixlSceneKind } from '../schema.js';
import {
  runExportPhaser,
  type RunExportPhaserOptions,
  type RunExportPhaserResult,
} from './exportPhaser.js';
import {
  runExportThree,
  type RunExportThreeOptions,
  type RunExportThreeResult,
} from './exportThree.js';

export type ExportPixllandRuntime = 'phaser-2d' | 'three-3d';

export interface RunExportPixllandOptions {
  assetSearchPaths?: string[];
  skipBundle?: boolean;
  sourcemap?: boolean;
  minify?: boolean;
  packedAt?: number;
  exportedAt?: number;
  cliPackageDir?: string;
  /**
   * Keep the intermediate static web build at this directory instead of
   * deleting the temporary build folder. Useful for smoke testing.
   */
  buildDir?: string;
}

export interface RunExportPixllandResult {
  outFile: string;
  buildDir: string | null;
  runtime: ExportPixllandRuntime;
  sceneKind: PixlSceneKind;
  archiveSize: number;
  manifest: PixlPackageManifest;
  build: RunExportThreeResult | RunExportPhaserResult;
}

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pixl-project';

const readProject = async (projectPath: string): Promise<PixlProjectShape> => {
  const raw = await readFile(projectPath, 'utf8');
  return JSON.parse(raw) as PixlProjectShape;
};

const resolveActiveSceneKind = (project: PixlProjectShape): PixlSceneKind => {
  const active = project.scenes.find((scene) => scene.id === project.activeSceneId);
  if (!active) {
    throw new Error(
      `export-pixlland: activeSceneId "${project.activeSceneId}" not found in project.scenes.`,
    );
  }
  return active.kind;
};

const runtimeForSceneKind = (kind: PixlSceneKind): ExportPixllandRuntime => {
  if (kind === '3d') return 'three-3d';
  return 'phaser-2d';
};

const ensurePackableProjectDocument = async (
  buildDir: string,
  fallback: PixlProjectShape,
  timestamp: number,
): Promise<void> => {
  const projectPath = resolve(buildDir, 'project.pixlproject.json');
  const raw = await readFile(projectPath, 'utf8');
  const project = JSON.parse(raw) as PixlProjectShape;
  const normalized: PixlProjectShape = {
    ...project,
    slug: project.slug ?? fallback.slug ?? slugify(project.name || fallback.name || project.id),
    createdAt: project.createdAt ?? fallback.createdAt ?? timestamp,
  };
  await writeFile(projectPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
};

export const runExportPixlland = async (
  projectPath: string,
  outFile: string,
  options: RunExportPixllandOptions = {},
): Promise<RunExportPixllandResult> => {
  const absProject = resolve(process.cwd(), projectPath);
  const absOut = resolve(process.cwd(), outFile);
  const sourceProject = await readProject(absProject);
  const sceneKind = resolveActiveSceneKind(sourceProject);
  const runtime = runtimeForSceneKind(sceneKind);
  const timestamp = options.exportedAt ?? Date.now();

  const shouldKeepBuild = Boolean(options.buildDir);
  const buildDir = options.buildDir
    ? resolve(process.cwd(), options.buildDir)
    : await mkdtemp(join(tmpdir(), 'pixl-export-pixlland-'));

  try {
    const sharedOptions = {
      assetSearchPaths: options.assetSearchPaths,
      skipBundle: options.skipBundle,
      sourcemap: options.sourcemap,
      minify: options.minify,
      exportedAt: timestamp,
      cliPackageDir: options.cliPackageDir,
    };
    const build = runtime === 'three-3d'
      ? await runExportThree(absProject, buildDir, sharedOptions as RunExportThreeOptions)
      : await runExportPhaser(absProject, buildDir, sharedOptions as RunExportPhaserOptions);

    await ensurePackableProjectDocument(buildDir, sourceProject, timestamp);

    const files = await readProjectFolder(buildDir);
    const packed = await packProject({
      files,
      packedAt: options.packedAt ?? timestamp,
    });
    await writeBytesToFile(absOut, packed.bytes);

    return {
      outFile: absOut,
      buildDir: shouldKeepBuild ? buildDir : null,
      runtime,
      sceneKind,
      archiveSize: packed.bytes.byteLength,
      manifest: packed.manifest,
      build,
    };
  } finally {
    if (!shouldKeepBuild) {
      await rm(buildDir, { recursive: true, force: true });
    }
  }
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const printExportPixllandResult = (result: RunExportPixllandResult): void => {
  console.log('pixl-engine export-pixlland');
  console.log(`  out:           ${result.outFile}`);
  console.log(`  runtime:       ${result.runtime}`);
  console.log(`  scene kind:    ${result.sceneKind}`);
  console.log(`  package size:  ${formatSize(result.archiveSize)}`);
  console.log(`  files:         ${result.manifest.files.length}`);
  console.log(`  project:       ${result.manifest.projectName} (${result.manifest.projectSlug})`);
  console.log(`  hash:          ${result.manifest.contentHash}`);
  console.log(`  assets copied: ${result.build.assetCount}`);
  console.log(`  bundle bytes:  ${result.build.bundleSizeBytes.toLocaleString()}`);
  if (result.build.missingAssets.length > 0) {
    console.log(`  missing:       ${result.build.missingAssets.length}`);
    for (const missing of result.build.missingAssets.slice(0, 5)) {
      console.log(`    - ${missing.path}${missing.url ? ` (url: ${missing.url})` : ''}`);
    }
    if (result.build.missingAssets.length > 5) {
      console.log(`    ... +${result.build.missingAssets.length - 5} more`);
    }
  }
  if (result.buildDir) {
    console.log(`  build dir:     ${result.buildDir}`);
  }
};

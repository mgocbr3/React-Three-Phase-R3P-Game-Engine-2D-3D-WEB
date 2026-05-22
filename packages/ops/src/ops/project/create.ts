// Op: project.create — scaffold a brand-new PixlPlayground project folder.
// Unlike most ops this one writes the *first* project document, so it bypasses
// the load→pre-validate step (there is nothing to load yet) and validates only
// the post-mutation doc.

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { broadcastProjectEvent } from '../../broadcast.js';
import {
  projectDocumentExists,
  saveProjectDocument,
} from '../../doc.js';
import { generateId } from '../../ids.js';
import { withProjectLock } from '../../lock.js';
import {
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  type PixlProjectShape,
  type PixlRuntimeKind,
  type PixlSceneShape,
} from '../../schema.js';
import {
  OpInputError,
  type OpContext,
  type OpResult,
} from '../../types.js';
import { validate } from '../../validate.js';

export type ProjectKind = '2d' | '3d';

export interface CreateProjectArgs {
  name: string;
  kind: ProjectKind;
  /** Optional fixed id (tests pass this for determinism). */
  id?: string;
  /** Optional fixed createdAt timestamp. */
  createdAt?: number;
  /** Refuse if the project document already exists (default true). */
  refuseIfExists?: boolean;
  /** Override the slug (default: slugified name). */
  slug?: string;
}

const DEFAULT_FOLDERS = [
  'Assets/3D_Models',
  'Assets/Sprites',
  'Assets/Tilemaps',
  'Assets/Textures',
  'Assets/Audio',
  'Assets/VFX',
  'Assets/Materials',
  'Assets/Prefabs',
  'Scenes',
  'Scripts',
  'ProjectSettings',
  'Builds',
];

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';

const sceneForKind = (kind: ProjectKind, sceneId: string): PixlSceneShape => {
  if (kind === '3d') {
    return {
      id: sceneId,
      name: 'Main',
      kind: '3d',
      rootObjects: [],
      camera: {
        id: 'main-camera',
        name: 'Main Camera',
        position: [10, 8, 10],
        target: [0, 0, 0],
        fov: 50,
        near: 0.1,
        far: 1000,
      },
      environment: {
        background: '#87ceeb',
        ambientLight: '#ffffff',
        ambientIntensity: 0.7,
      },
      physics: { engine: 'rapier', gravity: [0, -9.81, 0] },
    };
  }
  return {
    id: sceneId,
    name: 'Main',
    kind: '2d',
    rootObjects: [],
    camera: {
      id: 'main-camera-2d',
      name: 'Main Camera 2D',
      position: [0, 0, 0],
      target: [0, 0, 0],
    },
    environment: { background: '#101822' },
    physics: { engine: 'arcade', gravity: [0, 980] },
  };
};

const runtimeBlock = (kind: ProjectKind): { primary: PixlRuntimeKind; renderers: string[]; physics: string[] } =>
  kind === '3d'
    ? { primary: 'three-3d', renderers: ['three'], physics: ['rapier'] }
    : { primary: 'phaser-2d', renderers: ['phaser'], physics: ['arcade'] };

export const buildInitialDocument = (args: CreateProjectArgs): PixlProjectShape => {
  const sceneId = 'main';
  const createdAt = args.createdAt ?? Date.now();
  const id = args.id ?? generateId('project');
  return {
    format: PIXL_PROJECT_FORMAT,
    version: PIXL_PROJECT_VERSION,
    id,
    slug: args.slug ?? slugify(args.name),
    name: args.name,
    createdAt,
    savedAt: createdAt,
    activeSceneId: sceneId,
    scenes: [sceneForKind(args.kind, sceneId)],
    assets: { root: 'Assets', folders: [...DEFAULT_FOLDERS], entries: [] },
    engine: {
      name: 'PixlPlayground',
      schemaVersion: PIXL_PROJECT_VERSION,
    },
    runtime: runtimeBlock(args.kind),
    editor: {
      mode: args.kind,
      transformSpace: 'world',
      snapEnabled: false,
      selectedSceneId: sceneId,
    },
    game: {
      templateId: null,
      script: '// Pixlland game script\n',
    },
  };
};

export const createProject = async (
  ctx: OpContext,
  args: CreateProjectArgs,
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    if (typeof args.name !== 'string' || args.name.trim().length === 0) {
      return errorResult([new OpInputError('name é obrigatório').message]);
    }
    if (args.kind !== '2d' && args.kind !== '3d') {
      return errorResult([`kind inválido: ${String(args.kind)} (esperado '2d' ou '3d')`]);
    }
    const refuseIfExists = args.refuseIfExists ?? true;
    if (refuseIfExists && (await projectDocumentExists(ctx.projectDir))) {
      return errorResult([
        `Já existe um projeto em ${ctx.projectDir}. Passe refuseIfExists=false para sobrescrever.`,
      ]);
    }

    await fs.mkdir(ctx.projectDir, { recursive: true });
    for (const folder of DEFAULT_FOLDERS) {
      const folderPath = path.join(ctx.projectDir, folder);
      await fs.mkdir(folderPath, { recursive: true });
      const gitkeep = path.join(folderPath, '.gitkeep');
      try {
        await fs.access(gitkeep);
      } catch {
        await fs.writeFile(gitkeep, '', 'utf8');
      }
    }

    const doc = buildInitialDocument(args);
    const report = validate(doc);
    if (!report.ok) {
      return {
        ok: false,
        changedFiles: [],
        contentHash: '',
        validationWarnings: report.warnings,
        validationErrors: report.errors,
      };
    }
    const contentHash = await saveProjectDocument(ctx.projectDir, doc, {
      savedAt: args.createdAt,
    });
    broadcastProjectEvent({
      type: 'project.created',
      projectDir: ctx.projectDir,
      contentHash,
      byAgent: ctx.agent,
    });
    return {
      ok: true,
      changedFiles: ['project.pixlproject.json'],
      contentHash,
      validationWarnings: report.warnings,
      validationErrors: [],
    };
  });
};

// Re-exported for tests so they can build expected docs without invoking IO.
export const __testing = { buildInitialDocument };

const errorResult = (errors: string[]): OpResult => ({
  ok: false,
  changedFiles: [],
  contentHash: '',
  validationWarnings: [],
  validationErrors: errors,
});

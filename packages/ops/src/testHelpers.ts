// Test-only helpers. Excluded from build (see tsconfig.json) but available to
// vitest because vitest reads source TS directly.

import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildInitialDocument, type ProjectKind } from './ops/project/create.js';
import { saveProjectDocument } from './doc.js';
import { PIXL_PROJECT_DOCUMENT_FILENAME, type PixlProjectShape } from './schema.js';
import {
  unsubscribeAllProjectEvents,
  subscribeProjectEvents,
} from './broadcast.js';
import type { ProjectEvent } from './types.js';
import { __resetLocksForTests } from './lock.js';

export const FIXED_CREATED_AT = 1_700_000_000_000;

const SCAFFOLD_FOLDERS = [
  'Assets/3D_Models',
  'Assets/Sprites',
  'Assets/Audio',
  'Scenes',
  'Scripts',
  'ProjectSettings',
  'Builds',
];

export type FixtureMutator = (doc: PixlProjectShape) => PixlProjectShape;

export interface UsingFixtureOptions {
  kind?: ProjectKind;
  /** Inline mutation applied after the initial doc is built, before it's written to disk. */
  setup?: FixtureMutator;
  /** Override the project id (default 'project_test_001'). */
  id?: string;
  /** Override the project name (default 'Test Project'). */
  name?: string;
}

export const usingFixture = async <T>(
  options: UsingFixtureOptions,
  body: (projectDir: string) => Promise<T>,
): Promise<T> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pixl-ops-fx-'));
  try {
    // Scaffold folders
    for (const folder of SCAFFOLD_FOLDERS) {
      await fs.mkdir(path.join(dir, folder), { recursive: true });
    }
    const kind: ProjectKind = options.kind ?? '3d';
    const base = buildInitialDocument({
      name: options.name ?? 'Test Project',
      kind,
      id: options.id ?? 'project_test_001',
      createdAt: FIXED_CREATED_AT,
    });
    const finalDoc = options.setup ? options.setup(base) : base;
    await saveProjectDocument(dir, finalDoc, { savedAt: FIXED_CREATED_AT });
    return await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** Read project.pixlproject.json into memory. */
export const readDoc = async (projectDir: string): Promise<PixlProjectShape> => {
  const raw = await fs.readFile(path.join(projectDir, PIXL_PROJECT_DOCUMENT_FILENAME), 'utf8');
  return JSON.parse(raw) as PixlProjectShape;
};

/** Subscribe to ProjectEvents and capture them in an array. Returns the array
 *  and an unsubscribe function. Auto-cleans via afterEach if you don't call it. */
export const captureEvents = (): { events: ProjectEvent[]; stop: () => void } => {
  const events: ProjectEvent[] = [];
  const off = subscribeProjectEvents((event) => events.push(event));
  return {
    events,
    stop: () => {
      off();
    },
  };
};

/** Reset the global mutable state. Call in beforeEach. */
export const resetGlobalState = (): void => {
  unsubscribeAllProjectEvents();
  __resetLocksForTests();
};

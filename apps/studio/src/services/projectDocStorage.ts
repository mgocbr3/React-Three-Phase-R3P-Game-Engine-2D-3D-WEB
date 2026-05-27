/**
 * Per-project document storage.
 *
 * The editor used to keep a single `pixl-project-document` key in localStorage,
 * which meant switching projects (recents, samples, new) never replaced the
 * scene — every project shared the same document. This module fixes that by
 * also writing a per-projectId snapshot, so loading projectId X always restores
 * X's document.
 *
 * The singleton `pixl-project-document` is still maintained for backwards
 * compatibility with any code that reads it directly.
 */
import type { PixlProjectDocument, PixlSceneKind, PixlRuntimeKind } from '@/engine/project/schema';
import { DEFAULT_PROJECT_FOLDERS } from '@/engine/project/schema';

export const SINGLE_PROJECT_DOC_KEY = 'pixl-project-document';
const PER_ID_PREFIX = 'pixl-project-doc:';

export const perIdDocKey = (projectId: string) => `${PER_ID_PREFIX}${projectId}`;

const safeGet = (key: string): string | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[projectDocStorage] Failed to persist ${key}:`, error);
    return false;
  }
};

const safeRemove = (key: string): void => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const saveProjectDocSnapshot = (doc: PixlProjectDocument): void => {
  if (!doc?.id) return;
  const serialized = JSON.stringify(doc);
  safeSet(perIdDocKey(doc.id), serialized);
};

export const loadProjectDocSnapshot = (projectId: string): PixlProjectDocument | null => {
  const raw = safeGet(perIdDocKey(projectId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PixlProjectDocument;
    if (parsed?.format === 'pixlplayground-project') return parsed;
    return null;
  } catch {
    return null;
  }
};

export const removeProjectDocSnapshot = (projectId: string): void => {
  safeRemove(perIdDocKey(projectId));
};

/**
 * Build a fresh empty PixlProjectDocument for a brand-new project.
 * The choice of `kind` decides scene units, runtime primary, and the editor mode.
 */
export const createEmptyProjectDocument = (params: {
  id: string;
  name: string;
  kind?: PixlSceneKind;
  templateId?: string | null;
  createdAt?: number;
}): PixlProjectDocument => {
  const kind: PixlSceneKind = params.kind ?? '3d';
  const now = params.createdAt ?? Date.now();
  const slug = (params.name || 'untitled-project').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'untitled-project';

  const runtimePrimary: PixlRuntimeKind = kind === '2d' ? 'phaser-2d' : 'three-3d';
  const renderers = kind === '2d' ? ['phaser'] as const : ['three'] as const;

  const scene = kind === '2d'
    ? {
        id: 'main',
        name: 'Main',
        kind: '2d' as const,
        units: 'pixels' as const,
        rootObjects: [],
        camera: {
          id: 'editor-camera',
          name: 'Editor Camera',
          position: [0, 0, 0] as [number, number, number],
          target: [0, 0, 0] as [number, number, number],
          fov: 0,
          near: 0,
          far: 1000,
        },
        environment: {
          background: '#101820',
          ambientLight: '#ffffff',
          ambientIntensity: 1,
          sunColor: '#ffffff',
          sunIntensity: 0,
        },
        physics: {
          engine: 'arcade' as const,
          gravity: [0, 980, 0] as [number, number, number],
        },
      }
    : {
        id: 'main',
        name: 'Main',
        kind: '3d' as const,
        units: 'meters' as const,
        rootObjects: [],
        camera: {
          id: 'editor-camera',
          name: 'Editor Camera',
          position: [14, 10, 14] as [number, number, number],
          target: [0, 0, 0] as [number, number, number],
          fov: 50,
          near: 0.1,
          far: 1000,
        },
        environment: {
          background: '#87ceeb',
          ambientLight: '#ffffff',
          ambientIntensity: 0.7,
          sunColor: '#fffaf0',
          sunIntensity: 0.8,
        },
        physics: {
          engine: 'rapier' as const,
          gravity: [0, -9.81, 0] as [number, number, number],
        },
      };

  return {
    format: 'pixlplayground-project',
    version: 2,
    id: params.id,
    slug,
    name: params.name,
    createdAt: now,
    savedAt: now,
    engine: {
      name: 'PixlPlayground',
      version: '0.2.0',
      schemaVersion: 2,
    },
    runtime: {
      primary: runtimePrimary,
      renderers: [...renderers],
      physics: kind === '2d' ? ['arcade'] : ['rapier'],
    },
    activeSceneId: scene.id,
    scenes: [scene],
    assets: {
      root: 'Assets',
      folders: [...DEFAULT_PROJECT_FOLDERS],
      entries: [],
    },
    editor: {
      mode: kind,
      transformSpace: 'world',
      snapEnabled: false,
      snapTranslate: 1,
      snapRotate: 15,
      snapScale: 0.25,
      selectedSceneId: scene.id,
      layoutPreset: 'default',
    },
    game: {
      templateId: params.templateId ?? null,
      script: '// Game Script\n',
    },
  };
};

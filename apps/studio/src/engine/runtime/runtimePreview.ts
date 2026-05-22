import {
  PixlProjectDocument,
  PixlRuntimeKind,
  PixlSceneDocument,
  cloneJson,
  createPixlId,
} from '@/engine/project/schema';

export type RuntimePreviewSource = 'editor' | 'project-file';

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export interface RuntimePreviewSession {
  id: string;
  projectId: string;
  projectName: string;
  runtime: PixlRuntimeKind;
  launchTarget: RuntimePreviewLaunchTarget;
  sceneId: string;
  sceneKind: PixlSceneDocument['kind'];
  source: RuntimePreviewSource;
  startedAt: number;
  document: DeepReadonly<PixlProjectDocument>;
}

export type RuntimePreviewLaunchTarget =
  | { kind: 'scene-preview' }
  | {
      kind: 'web-runtime';
      gameSlug: string | null;
      runtimeFile: string;
      scriptUrl: string;
      documentBaseUrl: string;
      sdkUrl: string | null;
    };

const PIXLLAND_SDK_URL = 'https://pixlland.com/sdk/v1/pixlland.js';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const normalizeSlashes = (value: string) => value.replace(/\\/g, '/');

const normalizeFileSystemUrl = (value: string) => value.replace(/^\/@fs\/+/, '/@fs/');

const joinUrl = (baseUrl: string, projectPath: string) => (
  normalizeFileSystemUrl(`${baseUrl.replace(/\/+$/, '')}/${projectPath.replace(/^\/+/, '')}`)
);

const getProjectRootFromAssetEntry = (entry: PixlProjectDocument['assets']['entries'][number]) => {
  const url = isNonEmptyString(entry.url) ? normalizeSlashes(entry.url) : null;
  if (!url || url.startsWith('blob:') || /^(?:https?:|data:)/i.test(url)) return null;

  const portableCandidates = [
    entry.metadata?.sourceAsset,
    entry.metadata?.file,
    entry.url,
  ].filter(isNonEmptyString).map((value) => normalizeSlashes(value).replace(/^\/+/, ''));

  for (const portablePath of portableCandidates) {
    if (portablePath && url.endsWith(portablePath)) {
      return url.slice(0, -portablePath.length);
    }
  }

  const publicAssetIndex = url.indexOf('/public/assets/');
  if (publicAssetIndex >= 0) return `${url.slice(0, publicAssetIndex + 1)}`;

  const sourceIndex = url.indexOf('/src/');
  if (sourceIndex >= 0) return `${url.slice(0, sourceIndex + 1)}`;

  return null;
};

const getProjectRootUrl = (document: PixlProjectDocument) => {
  for (const entry of document.assets.entries) {
    const projectRoot = getProjectRootFromAssetEntry(entry);
    if (projectRoot) return projectRoot;
  }

  return null;
};

export const resolveRuntimeLaunchTarget = (document: PixlProjectDocument): RuntimePreviewLaunchTarget => {
  const source = isRecord(document.game.source) ? document.game.source : {};
  const runtimeFile = isNonEmptyString(source.runtimeFile) ? source.runtimeFile.trim() : null;

  if (!runtimeFile) return { kind: 'scene-preview' };

  const projectRootUrl = isNonEmptyString(source.runtimeBaseUrl)
    ? source.runtimeBaseUrl.trim()
    : isNonEmptyString(source.assetBaseUrl)
      ? source.assetBaseUrl.trim()
      : getProjectRootUrl(document);
  if (!projectRootUrl) return { kind: 'scene-preview' };

  const runtimePath = normalizeSlashes(runtimeFile).replace(/^\/+/, '');
  const gameSlug = isNonEmptyString(source.game)
    ? source.game.trim()
    : isRecord(document.integrations?.pixlland) && isNonEmptyString(document.integrations.pixlland.gameSlug)
      ? document.integrations.pixlland.gameSlug.trim()
      : null;

  return {
    kind: 'web-runtime',
    gameSlug,
    runtimeFile: runtimePath,
    scriptUrl: joinUrl(projectRootUrl, runtimePath),
    documentBaseUrl: joinUrl(projectRootUrl, 'public/'),
    sdkUrl: document.integrations?.pixlland ? PIXLLAND_SDK_URL : null,
  };
};

export const getActiveRuntimeScene = (document: PixlProjectDocument): PixlSceneDocument => {
  const scene = document.scenes.find((item) => item.id === document.activeSceneId) ?? document.scenes[0];

  if (!scene) {
    throw new Error('Projeto PixlPlayground sem cena ativa para executar.');
  }

  return scene;
};

export const resolveRuntimeKind = (document: PixlProjectDocument): PixlRuntimeKind => {
  if (document.runtime.primary !== 'hybrid') return document.runtime.primary;

  const scene = getActiveRuntimeScene(document);
  if (scene.kind === '2d') return 'phaser-2d';
  if (scene.kind === '3d') return 'three-3d';
  return document.runtime.renderers.includes('phaser') ? 'phaser-2d' : 'three-3d';
};

export const getRuntimeAdapterLabel = (runtime: PixlRuntimeKind) => {
  switch (runtime) {
    case 'phaser-2d':
      return 'Phaser 2D';
    case 'three-3d':
      return 'Three.js 3D';
    case 'hybrid':
      return 'Hybrid';
  }
};

const deepFreeze = <T>(value: T): DeepReadonly<T> => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }

  Object.getOwnPropertyNames(value).forEach((key) => {
    const nested = (value as Record<string, unknown>)[key];
    if (nested && typeof nested === 'object') {
      deepFreeze(nested);
    }
  });

  return Object.freeze(value) as DeepReadonly<T>;
};

export const createRuntimePreviewSession = (
  document: PixlProjectDocument,
  options: {
    source?: RuntimePreviewSource;
    startedAt?: number;
  } = {},
): RuntimePreviewSession => {
  const snapshot = cloneJson(document);
  const scene = getActiveRuntimeScene(snapshot);
  const runtime = resolveRuntimeKind(snapshot);
  const launchTarget = resolveRuntimeLaunchTarget(snapshot);

  return {
    id: createPixlId('runtime'),
    projectId: snapshot.id,
    projectName: snapshot.name,
    runtime,
    launchTarget,
    sceneId: scene.id,
    sceneKind: scene.kind,
    source: options.source ?? 'editor',
    startedAt: options.startedAt ?? Date.now(),
    document: deepFreeze(snapshot),
  };
};

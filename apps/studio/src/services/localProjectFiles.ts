import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { useAssetStore } from '@/stores/assetStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewportStore, type ViewportMode } from '@/stores/viewportStore';
import {
  AnyPixlProjectDocument,
  DEFAULT_PROJECT_FOLDERS,
  PixlVec3,
  PixlProjectDocument,
  PixlAssetEntry,
  PixlSceneDocument,
  cloneJson,
} from '@/engine/project/schema';
import {
  createEditorSnapshotFromProjectDocument,
  createLegacyEditorSave,
  createProjectDocumentFromEditorState,
  normalizeProjectDocument,
} from '@/engine/project/editorProjectAdapter';
import { withFilePicker } from './filePickerLock';
import {
  SINGLE_PROJECT_DOC_KEY,
  saveProjectDocSnapshot,
  loadProjectDocSnapshot,
  removeProjectDocSnapshot,
  createEmptyProjectDocument,
} from './projectDocStorage';
import type { PixlSceneKind } from '@/engine/project/schema';

// sampleProjects.ts imports from THIS file (applyProjectDocumentToEditor),
// so we resolve it lazily to avoid a top-level circular import in Vite.
const loadSampleHelpers = async () => import('./sampleProjects');

export const PIXL_PROJECT_FILE = 'project.pixlproject.json';

type FileSystemPermissionMode = 'read' | 'readwrite';

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { id?: string; mode?: FileSystemPermissionMode }) => Promise<FileSystemDirectoryHandle>;
  }
}

let currentProjectDirectory: FileSystemDirectoryHandle | null = null;
let currentProjectFilePath = [PIXL_PROJECT_FILE];
let currentProjectDocument: PixlProjectDocument | null = null;
let currentProjectAssetBaseUrl: string | null = null;
const objectUrlByProjectPath = new Map<string, string>();
const projectPathByObjectUrl = new Map<string, string>();

export interface LocalProjectWorkspace {
  directoryName: string | null;
  projectFilePath: string;
  projectId: string | null;
  writable: boolean;
}

interface ApplyProjectDocumentOptions {
  assetBaseUrl?: string | null;
  workspace?: {
    directory: FileSystemDirectoryHandle | null;
    projectFilePath?: string[];
  };
}

const ASSET_URL_KEYS = new Set([
  'url',
  'src',
  'href',
  'modelUrl',
  'textureUrl',
  'thumbnail',
  'thumbnailUrl',
  'audioUrl',
]);

const ASSET_PATH_KEYS = new Set([
  'path',
]);

const ASSET_REFERENCE_RE = /\.(?:glb|gltf|fbx|obj|png|jpe?g|webp|svg|mp3|wav|ogg|opus|json|js|mjs|css)(?:[?#].*)?$/i;
const GAMES_SRC_RE = /(?:^|\/)apps\/portal\/games-src\/[^/]+\/(.+)$/i;
const SAMPLE_PROJECT_RE = /(?:^|\/)engine\/apps\/studio\/public\/sample-projects\/[^/]+\/(.+)$/i;
const WORKSPACE_DB_NAME = 'pixlplayground-local-workspaces';
const WORKSPACE_STORE_NAME = 'workspaces';

const normalizeSlashes = (value: string) => value.replace(/\\/g, '/');

const stripQueryAndHash = (value: string) => value.replace(/[?#].*$/, '');

const isExternalUrl = (value: string) => /^(?:https?:|data:)/i.test(value);

export const getPortableAssetPath = (value: string): string | null => {
  if (!value) return null;

  const mappedPath = projectPathByObjectUrl.get(value);
  if (mappedPath) return mappedPath;
  if (isExternalUrl(value)) return null;

  let candidate = normalizeSlashes(value.trim());
  if (!candidate || candidate.startsWith('blob:')) return null;

  try {
    candidate = decodeURI(candidate);
  } catch {
    // Keep the original value when it is not a URI-encoded path.
  }

  if (candidate.startsWith('/@fs/')) {
    candidate = candidate.slice('/@fs/'.length);
  }

  candidate = normalizeSlashes(candidate);

  const gameSourceMatch = candidate.match(GAMES_SRC_RE);
  if (gameSourceMatch?.[1]) return gameSourceMatch[1];

  const sampleProjectMatch = candidate.match(SAMPLE_PROJECT_RE);
  if (sampleProjectMatch?.[1]) return sampleProjectMatch[1];

  const withoutPrefix = candidate.replace(/^\.\//, '').replace(/^\/+/, '');
  if (/^[a-z]:\//i.test(withoutPrefix)) return null;
  if (!ASSET_REFERENCE_RE.test(stripQueryAndHash(withoutPrefix))) return null;

  return withoutPrefix;
};

const joinUrl = (baseUrl: string, projectPath: string) => (
  `${baseUrl.replace(/\/+$/, '')}/${projectPath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`
    .replace(/%2F/g, '/')
);

const resolveFileHandle = async (
  directory: FileSystemDirectoryHandle,
  pathParts: string[],
  options?: { create?: boolean },
) => {
  if (!pathParts.length || pathParts.some((part) => !part || part === '..' || part === '.')) {
    throw new Error('Caminho de arquivo invalido dentro do projeto.');
  }

  let current = directory;
  for (const part of pathParts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, options);
  }

  return current.getFileHandle(pathParts[pathParts.length - 1], options);
};

const tryResolveFileHandle = async (
  directory: FileSystemDirectoryHandle,
  pathParts: string[],
) => {
  try {
    return await resolveFileHandle(directory, pathParts);
  } catch {
    return null;
  }
};

const revokeResolvedAssetUrls = () => {
  objectUrlByProjectPath.forEach((url) => URL.revokeObjectURL(url));
  objectUrlByProjectPath.clear();
  projectPathByObjectUrl.clear();
};

const resolveProjectPathToObjectUrl = async (
  directory: FileSystemDirectoryHandle,
  projectPath: string,
) => {
  const normalizedPath = projectPath.replace(/^\.\//, '').replace(/^\/+/, '');
  const cachedUrl = objectUrlByProjectPath.get(normalizedPath);
  if (cachedUrl) return cachedUrl;

  const fileHandle = await tryResolveFileHandle(directory, normalizedPath.split('/'));
  if (!fileHandle) return null;

  const file = await fileHandle.getFile();
  const objectUrl = URL.createObjectURL(file);
  objectUrlByProjectPath.set(normalizedPath, objectUrl);
  projectPathByObjectUrl.set(objectUrl, normalizedPath);
  return objectUrl;
};

const shouldTransformAssetReference = (key: string, value: string) => {
  if (ASSET_URL_KEYS.has(key)) return Boolean(getPortableAssetPath(value));
  if (ASSET_PATH_KEYS.has(key)) return Boolean(projectPathByObjectUrl.has(value));
  return false;
};

const transformProjectAssetReferences = async (
  value: unknown,
  transform: (path: string, currentValue: string) => Promise<string | null>,
  key = '',
): Promise<unknown> => {
  if (typeof value === 'string') {
    if (!shouldTransformAssetReference(key, value)) return value;

    const portablePath = getPortableAssetPath(value);
    if (!portablePath) return value;

    return (await transform(portablePath, value)) ?? value;
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => transformProjectAssetReferences(item, transform)));
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([entryKey, entryValue]) => [
        entryKey,
        await transformProjectAssetReferences(entryValue, transform, entryKey),
      ]),
    );
    return Object.fromEntries(entries);
  }

  return value;
};

const transformProjectAssetReferencesSync = (
  value: unknown,
  transform: (path: string, currentValue: string) => string | null,
  key = '',
): unknown => {
  if (typeof value === 'string') {
    if (!shouldTransformAssetReference(key, value)) return value;

    const portablePath = getPortableAssetPath(value);
    if (!portablePath) return value;

    return transform(portablePath, value) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => transformProjectAssetReferencesSync(item, transform));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        transformProjectAssetReferencesSync(entryValue, transform, entryKey),
      ]),
    );
  }

  return value;
};

export const resolveProjectDocumentAssetUrls = async (
  document: PixlProjectDocument,
  options: {
    directory?: FileSystemDirectoryHandle;
    assetBaseUrl?: string;
  } = {},
): Promise<PixlProjectDocument> => {
  const resolved = await transformProjectAssetReferences(document, async (projectPath) => {
    if (options.directory) {
      return resolveProjectPathToObjectUrl(options.directory, projectPath);
    }

    if (options.assetBaseUrl) {
      return joinUrl(options.assetBaseUrl, projectPath);
    }

    return null;
  });

  return resolved as PixlProjectDocument;
};

export const makeProjectDocumentPortable = (document: PixlProjectDocument): PixlProjectDocument => (
  transformProjectAssetReferencesSync(document, (projectPath) => projectPath) as PixlProjectDocument
);

export const supportsLocalProjectFolders = () => (
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  typeof window.showDirectoryPicker === 'function'
);

export const getCurrentProjectDirectoryName = () => currentProjectDirectory?.name || null;

export const getCurrentProjectWorkspace = (): LocalProjectWorkspace => ({
  directoryName: getCurrentProjectDirectoryName(),
  projectFilePath: currentProjectFilePath.join('/'),
  projectId: currentProjectDocument?.id ?? null,
  writable: Boolean(currentProjectDirectory),
});

export const hasActiveProjectWorkspace = () => Boolean(currentProjectDirectory);

/**
 * True once `applyProjectDocumentToEditor` has been called at least once
 * during the current page lifetime. Used by `useEditorAutosave` to avoid
 * persisting empty/orphan docs during the brief window between component
 * mount and the sample/local-project being loaded.
 */
export const hasLoadedAnyProjectDocument = (): boolean => Boolean(currentProjectDocument);

export const getActiveProjectDocumentId = (): string | null => currentProjectDocument?.id ?? null;

const openWorkspaceDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(WORKSPACE_STORE_NAME, { keyPath: 'projectId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Nao foi possivel abrir o indice de projetos locais.'));
  });
};

const withWorkspaceStore = async <T,>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> => {
  const db = await openWorkspaceDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE_NAME, mode);
    const request = run(transaction.objectStore(WORKSPACE_STORE_NAME));

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar projeto local.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error('Falha ao salvar referencia local do projeto.'));
    };
  });
};

const persistCurrentProjectWorkspace = async (project: PixlProjectDocument) => {
  if (!currentProjectDirectory) return;

  try {
    await withWorkspaceStore('readwrite', (store) => store.put({
      projectId: project.id,
      directory: currentProjectDirectory,
      directoryName: currentProjectDirectory.name,
      projectFilePath: [...currentProjectFilePath],
      updatedAt: Date.now(),
    }));
  } catch (error) {
    console.warn('[localProjectFiles] Could not persist local workspace handle:', error);
  }
};

const getStoredProjectWorkspace = async (projectId: string) => (
  await withWorkspaceStore<{
    projectId: string;
    directory: FileSystemDirectoryHandle;
    directoryName: string;
    projectFilePath: string[];
    updatedAt: number;
  }>('readonly', (store) => store.get(projectId))
);

/**
 * Initialize a brand-new local project: writes metadata to useProjectStore,
 * seeds an empty PixlProjectDocument (per `kind`), applies it to the editor,
 * and persists it both in the singleton key and the per-id snapshot.
 *
 * This replaces the previous "create metadata only" flow that left the editor
 * still showing whatever scene was loaded before.
 */
export const createEmptyLocalProject = (params: {
  id: string;
  name: string;
  kind?: PixlSceneKind;
  templateId?: string | null;
}): PixlProjectDocument => {
  const doc = createEmptyProjectDocument({
    id: params.id,
    name: params.name,
    kind: params.kind,
    templateId: params.templateId ?? null,
  });
  applyProjectDocumentToEditor(doc);
  return doc;
};

export const deleteLocalProjectDoc = (projectId: string): void => {
  removeProjectDocSnapshot(projectId);
};

export const createProjectDocumentFromEditor = (name = 'Untitled Project'): PixlProjectDocument => {
  const {
    objects,
    gameScript,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
  } = useEditorStore.getState();

  const now = Date.now();
  const stateDocument = createProjectDocumentFromEditorState({
    objects,
    gameScript,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
  }, {
    id: currentProjectDocument?.id,
    name: name || currentProjectDocument?.name,
    slug: currentProjectDocument?.slug,
    createdAt: currentProjectDocument?.createdAt,
    savedAt: now,
  });

  if (!currentProjectDocument) return stateDocument;

  const activeSceneId = currentProjectDocument.activeSceneId || stateDocument.activeSceneId;
  const editedScene = stateDocument.scenes[0];
  const existingScene = currentProjectDocument.scenes.find((scene) => scene.id === activeSceneId);
  const nextScene: PixlSceneDocument = {
    ...(existingScene ?? editedScene),
    rootObjects: editedScene.rootObjects,
  };
  const existingScenes = currentProjectDocument.scenes.length ? currentProjectDocument.scenes : [editedScene];
  const replacedActiveScene = existingScenes.some((scene) => scene.id === activeSceneId);
  const scenes = replacedActiveScene
    ? existingScenes.map((scene) => scene.id === activeSceneId ? nextScene : scene)
    : [nextScene, ...existingScenes];
  const entriesByKey = new Map<string, PixlAssetEntry>();

  [...(currentProjectDocument.assets?.entries ?? []), ...(stateDocument.assets.entries ?? [])].forEach((entry) => {
    const key = entry.id || entry.url || entry.path;
    entriesByKey.set(key, { ...entry });
  });

  return {
    ...cloneJson(currentProjectDocument),
    name: name?.trim() || currentProjectDocument.name,
    savedAt: now,
    activeSceneId,
    scenes,
    assets: {
      root: currentProjectDocument.assets?.root ?? stateDocument.assets.root,
      folders: currentProjectDocument.assets?.folders?.length
        ? [...currentProjectDocument.assets.folders]
        : [...stateDocument.assets.folders],
      entries: [...entriesByKey.values()],
    },
    editor: {
      ...currentProjectDocument.editor,
      ...stateDocument.editor,
      selectedSceneId: activeSceneId,
    },
    game: {
      ...currentProjectDocument.game,
      templateId: stateDocument.game.templateId,
      script: stateDocument.game.script,
    },
  };
};

export const prepareProjectDocumentForRuntimePreview = (document: PixlProjectDocument): PixlProjectDocument => {
  if (!currentProjectAssetBaseUrl) return document;

  const source = document.game.source ?? {};
  if (typeof source.runtimeBaseUrl === 'string' && source.runtimeBaseUrl.trim()) {
    return document;
  }

  return {
    ...cloneJson(document),
    game: {
      ...document.game,
      source: {
        ...source,
        runtimeBaseUrl: currentProjectAssetBaseUrl,
      },
    },
  };
};

const getSceneFocus = (objects: Array<{ position: PixlVec3; scale?: PixlVec3 }>) => {
  if (!objects.length) {
    return {
      position: [0, 0, 0] as PixlVec3,
      distance: 16,
    };
  }

  const min: PixlVec3 = [Infinity, Infinity, Infinity];
  const max: PixlVec3 = [-Infinity, -Infinity, -Infinity];

  objects.forEach((object) => {
    const scale = object.scale ?? [1, 1, 1];
    for (let axis = 0; axis < 3; axis += 1) {
      const extent = Math.max(0.5, Math.abs(scale[axis]) * 0.5);
      min[axis] = Math.min(min[axis], object.position[axis] - extent);
      max[axis] = Math.max(max[axis], object.position[axis] + extent);
    }
  });

  const position: PixlVec3 = [
    (min[0] + max[0]) / 2,
    Math.max(0, (min[1] + max[1]) / 2),
    (min[2] + max[2]) / 2,
  ];
  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];
  const diagonal = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));

  return {
    position,
    distance: Math.min(140, Math.max(18, diagonal * 0.7)),
  };
};

export const applyProjectDocumentToEditor = (
  document: AnyPixlProjectDocument,
  options: ApplyProjectDocumentOptions = {},
) => {
  const project = normalizeProjectDocument(document);
  const snapshot = createEditorSnapshotFromProjectDocument(project);
  const portableProject = makeProjectDocumentPortable(project);
  const focus = getSceneFocus(snapshot.objects.map((object) => ({
    position: object.position,
    scale: object.scale,
  })));

  useAssetStore.getState().clearCache();

  if ('workspace' in options) {
    currentProjectDirectory = options.workspace?.directory ?? null;
    currentProjectFilePath = options.workspace?.projectFilePath ?? [PIXL_PROJECT_FILE];
  } else {
    currentProjectDirectory = null;
    currentProjectFilePath = [PIXL_PROJECT_FILE];
  }

  currentProjectDocument = portableProject;
  currentProjectAssetBaseUrl = options.assetBaseUrl ?? null;

  useEditorStore.setState({
    objects: snapshot.objects,
    gameScript: snapshot.gameScript,
    transformSpace: (snapshot.transformSpace as any) || 'world',
    snapEnabled: snapshot.snapEnabled,
    snapTranslate: snapshot.snapTranslate,
    snapRotate: snapshot.snapRotate,
    snapScale: snapshot.snapScale,
    selectedObjectId: null,
    focusTarget: {
      position: focus.position,
      distance: focus.distance,
      timestamp: Date.now(),
    },
    history: [JSON.parse(JSON.stringify(snapshot.objects))],
    historyIndex: 0,
  });

  useAssetStore.setState({
    projectAssets: snapshot.projectAssets,
  });

  // Lock the viewport to the project's declared kind. Projects with kind
  // 'hybrid' fall back to 3d (Three.js host) so the editor still mounts; a
  // future iteration may render both runtimes side-by-side for hybrid.
  const activeScene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  const sceneKind: ViewportMode = activeScene?.kind === '2d' ? '2d' : '3d';
  useViewportStore.getState().setLockedKind(sceneKind);

  useProjectStore.getState().upsertProject({
    id: project.id,
    name: project.name,
    templateId: project.game.templateId,
    createdAt: project.createdAt,
    updatedAt: project.savedAt,
  });

  try {
    localStorage.setItem(SINGLE_PROJECT_DOC_KEY, JSON.stringify(portableProject));
    localStorage.setItem('pixl-project-save', JSON.stringify(createLegacyEditorSave(portableProject)));
  } catch (error) {
    console.warn('[localProjectFiles] Failed to persist singleton document keys:', error);
  }
  // Per-project snapshot — enables true multi-project switching without losing scenes.
  saveProjectDocSnapshot(portableProject);
};

const ensurePermission = async (directory: FileSystemDirectoryHandle) => {
  if (!directory.queryPermission || !directory.requestPermission) return true;

  const query = await directory.queryPermission({ mode: 'readwrite' });
  if (query === 'granted') return true;

  const request = await directory.requestPermission({ mode: 'readwrite' });
  return request === 'granted';
};

const ensureProjectFolders = async (directory: FileSystemDirectoryHandle) => {
  for (const folder of DEFAULT_PROJECT_FOLDERS) {
    const parts = folder.split('/').filter(Boolean);
    let current = directory;

    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }
};

export const saveProjectDocumentToDirectory = async (document: PixlProjectDocument): Promise<LocalProjectWorkspace> => {
  const portableDocument = makeProjectDocumentPortable(document);

  if (!supportsLocalProjectFolders()) {
    const blob = new Blob([JSON.stringify(portableDocument, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = PIXL_PROJECT_FILE;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Projeto exportado como arquivo JSON.');
    return getCurrentProjectWorkspace();
  }

  if (!currentProjectDirectory) {
    currentProjectDirectory = await withFilePicker('open project folder', () => (
      window.showDirectoryPicker!({
        id: 'pixlplayground-project',
        mode: 'readwrite',
      })
    ));
    currentProjectFilePath = [PIXL_PROJECT_FILE];
  }

  const permitted = await ensurePermission(currentProjectDirectory);
  if (!permitted) {
    throw new Error('Permissao negada para salvar na pasta do projeto.');
  }

  await ensureProjectFolders(currentProjectDirectory);
  const fileHandle = await resolveFileHandle(currentProjectDirectory, currentProjectFilePath, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(portableDocument, null, 2));
  await writable.close();

  currentProjectDocument = portableDocument;
  await persistCurrentProjectWorkspace(portableDocument);
  useProjectStore.getState().upsertProject({
    id: portableDocument.id,
    name: portableDocument.name,
    templateId: portableDocument.game.templateId,
    createdAt: portableDocument.createdAt,
    updatedAt: portableDocument.savedAt,
  });
  localStorage.setItem('pixl-project-document', JSON.stringify(portableDocument));
  localStorage.setItem('pixl-project-save', JSON.stringify(createLegacyEditorSave(portableDocument)));

  return getCurrentProjectWorkspace();
};

export const saveActiveProjectDocumentToDirectory = async (name?: string): Promise<LocalProjectWorkspace> => (
  saveProjectDocumentToDirectory(createProjectDocumentFromEditor(name ?? currentProjectDocument?.name ?? 'Untitled Project'))
);

const findProjectFile = async (directory: FileSystemDirectoryHandle) => {
  const candidates = [
    [PIXL_PROJECT_FILE],
    ['pixlplayground', PIXL_PROJECT_FILE],
  ];

  for (const candidate of candidates) {
    const fileHandle = await tryResolveFileHandle(directory, candidate);
    if (fileHandle) {
      return {
        fileHandle,
        path: candidate,
      };
    }
  }

  throw new Error(`Pasta sem ${PIXL_PROJECT_FILE}. Escolha a pasta raiz do projeto ou a pasta pixlplayground.`);
};

export const openProjectDocumentFromDirectory = async () => {
  if (!supportsLocalProjectFolders()) {
    throw new Error('Seu navegador atual nao permite abrir pastas. Use Chrome/Edge ou a futura versao desktop.');
  }

  const directory = await withFilePicker('open project folder', () => (
    window.showDirectoryPicker!({
      id: 'pixlplayground-project',
      mode: 'readwrite',
    })
  ));
  const { fileHandle, path } = await findProjectFile(directory);
  const file = await fileHandle.getFile();
  const document = normalizeProjectDocument(JSON.parse(await file.text()) as AnyPixlProjectDocument);

  revokeResolvedAssetUrls();
  const resolvedDocument = await resolveProjectDocumentAssetUrls(document, { directory });
  applyProjectDocumentToEditor(resolvedDocument, {
    workspace: {
      directory,
      projectFilePath: path,
    },
  });
  await persistCurrentProjectWorkspace(makeProjectDocumentPortable(resolvedDocument));

  return {
    directory,
    document: resolvedDocument,
    workspace: getCurrentProjectWorkspace(),
  };
};

export const openStoredProjectWorkspace = async (projectId: string) => {
  const stored = await getStoredProjectWorkspace(projectId);
  if (!stored?.directory) {
    // Fallback 1: per-project snapshot in localStorage (set by applyProjectDocumentToEditor).
    const snapshot = loadProjectDocSnapshot(projectId);
    if (snapshot) {
      const resolved = await resolveProjectDocumentAssetUrls(snapshot);
      applyProjectDocumentToEditor(resolved);
      return {
        directory: null,
        document: resolved,
        workspace: getCurrentProjectWorkspace(),
      };
    }
    // Fallback 2: maybe this projectId is actually a sample slug we shipped.
    const { hasSampleProject, loadSampleProjectDocument } = await loadSampleHelpers();
    if (hasSampleProject(projectId)) {
      const sampleDoc = await loadSampleProjectDocument(projectId);
      applyProjectDocumentToEditor(sampleDoc);
      return {
        directory: null,
        document: sampleDoc,
        workspace: getCurrentProjectWorkspace(),
      };
    }
    throw new Error('Projeto local nao encontrado neste navegador. Abra a pasta do projeto novamente.');
  }

  const permitted = await ensurePermission(stored.directory);
  if (!permitted) {
    throw new Error('Permissao negada para reabrir a pasta do projeto.');
  }

  const fileHandle = await resolveFileHandle(stored.directory, stored.projectFilePath);
  const file = await fileHandle.getFile();
  const document = normalizeProjectDocument(JSON.parse(await file.text()) as AnyPixlProjectDocument);

  revokeResolvedAssetUrls();
  const resolvedDocument = await resolveProjectDocumentAssetUrls(document, { directory: stored.directory });
  applyProjectDocumentToEditor(resolvedDocument, {
    workspace: {
      directory: stored.directory,
      projectFilePath: stored.projectFilePath,
    },
  });

  return {
    directory: stored.directory,
    document: resolvedDocument,
    workspace: getCurrentProjectWorkspace(),
  };
};

import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { useAssetStore, type ProjectAsset } from '@/stores/assetStore';
import { useProjectStore } from '@/stores/projectStore';
import { useViewportStore } from '@/stores/viewportStore';
import {
  AnyPixlProjectDocument,
  DEFAULT_PROJECT_FOLDERS,
  PixlVec3,
  PixlProjectDocument,
  PixlAssetEntry,
  PixlAssetKind,
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
  removeEntry?(name: string, options?: { recursive?: boolean }): Promise<void>;
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
  'imageUrl',
  'thumbnail',
  'thumbnailUrl',
  'audioUrl',
  'texturePath',
  'tilemapPath',
  'sourceAsset',
]);

const ASSET_PATH_KEYS = new Set([
  'path',
]);

const ASSET_REFERENCE_RE = /\.(?:glb|gltf|fbx|obj|png|jpe?g|webp|svg|mp3|wav|ogg|opus|json|js|mjs|css)(?:[?#].*)?$/i;
const GAMES_SRC_RE = /(?:^|\/)apps\/portal\/games-src\/[^/]+\/(.+)$/i;
const SAMPLE_PROJECT_RE = /(?:^|\/)engine\/apps\/studio\/public\/sample-projects\/[^/]+\/(.+)$/i;
const PUBLIC_SAMPLE_PROJECT_RE = /(?:^|\/)sample-projects\/[^/]+\/(.+)$/i;
const WORKSPACE_DB_NAME = 'pixlplayground-local-workspaces';
const WORKSPACE_STORE_NAME = 'workspaces';

const normalizeSlashes = (value: string) => value.replace(/\\/g, '/');

const stripQueryAndHash = (value: string) => value.replace(/[?#].*$/, '');

const isExternalUrl = (value: string) => /^(?:https?:|data:)/i.test(value);

const stripLeadingProjectSlashes = (value: string) => normalizeSlashes(value).replace(/^\.\//, '').replace(/^\/+/, '');

export const normalizeProjectFolderPath = (folderPath: string): string => {
  const normalized = stripLeadingProjectSlashes(folderPath.trim()).replace(/\/+$/, '');
  if (!normalized || normalized === '.') return 'Assets';

  const parts = normalized.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Caminho de pasta invalido dentro do projeto.');
  }

  return parts.join('/');
};

const sanitizeProjectFileName = (fileName: string): string => {
  const sanitized = fileName
    .replace(/[<>:"\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || `asset-${Date.now()}`;
};

const getProjectAssetPathFromAsset = (asset: Pick<ProjectAsset, 'url' | 'path' | 'folder' | 'name' | 'metadata'>): string | null => {
  if (asset.path) return stripLeadingProjectSlashes(asset.path);

  const metadataPath = typeof asset.metadata?.projectPath === 'string'
    ? asset.metadata.projectPath
    : typeof asset.metadata?.path === 'string'
      ? asset.metadata.path
      : null;
  if (metadataPath) return stripLeadingProjectSlashes(metadataPath);

  return getPortableAssetPath(asset.url);
};

const releaseObjectUrlForProjectPath = (projectPath: string) => {
  const normalizedPath = stripLeadingProjectSlashes(projectPath);
  const url = objectUrlByProjectPath.get(normalizedPath);
  if (!url) return;

  URL.revokeObjectURL(url);
  objectUrlByProjectPath.delete(normalizedPath);
  projectPathByObjectUrl.delete(url);
};

const ensureProjectDirectoryPath = async (
  directory: FileSystemDirectoryHandle,
  folderPath: string,
) => {
  const normalizedFolder = normalizeProjectFolderPath(folderPath);
  let current = directory;

  for (const part of normalizedFolder.split('/').filter(Boolean)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }

  return current;
};

const projectFileExists = async (
  directory: FileSystemDirectoryHandle,
  projectPath: string,
) => Boolean(await tryResolveFileHandle(directory, stripLeadingProjectSlashes(projectPath).split('/')));

const getAvailableProjectFilePath = async (
  directory: FileSystemDirectoryHandle,
  folderPath: string,
  fileName: string,
) => {
  const normalizedFolder = normalizeProjectFolderPath(folderPath);
  const safeName = sanitizeProjectFileName(fileName);
  const dotIndex = safeName.lastIndexOf('.');
  const stem = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const ext = dotIndex > 0 ? safeName.slice(dotIndex) : '';

  let candidate = `${normalizedFolder}/${safeName}`;
  let suffix = 2;
  while (await projectFileExists(directory, candidate)) {
    candidate = `${normalizedFolder}/${stem}-${suffix}${ext}`;
    suffix += 1;
  }

  return candidate;
};

const writeProjectFile = async (
  directory: FileSystemDirectoryHandle,
  projectPath: string,
  data: BlobPart,
) => {
  const normalizedPath = stripLeadingProjectSlashes(projectPath);
  const parts = normalizedPath.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Caminho de arquivo invalido dentro do projeto.');

  await ensureProjectDirectoryPath(directory, parts.slice(0, -1).join('/'));
  const fileHandle = await resolveFileHandle(directory, parts, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
  releaseObjectUrlForProjectPath(normalizedPath);
};

const removeProjectFile = async (
  directory: FileSystemDirectoryHandle,
  projectPath: string,
) => {
  if (!directory.removeEntry) return;

  const normalizedPath = stripLeadingProjectSlashes(projectPath);
  const parts = normalizedPath.split('/').filter(Boolean);
  if (parts.length < 2) return;

  let current = directory;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part);
  }

  await current.removeEntry(parts[parts.length - 1]);
  releaseObjectUrlForProjectPath(normalizedPath);
};

const PROJECT_ASSET_TYPE_TO_KIND: Record<ProjectAsset['type'], PixlAssetKind> = {
  model: 'model',
  texture: 'texture',
  image: 'image',
  sprite: 'sprite',
  spritesheet: 'spritesheet',
  tilemap: 'tilemap',
  audio: 'audio',
  script: 'script',
};

const getAssetFileName = (asset: Pick<ProjectAsset, 'name' | 'url' | 'path'>): string => {
  const source = asset.path || asset.url || asset.name;
  return stripQueryAndHash(source).split('/').pop() || asset.name;
};

const projectAssetToManifestEntry = (asset: ProjectAsset, index: number): PixlAssetEntry => {
  const portablePath = getProjectAssetPathFromAsset(asset)
    ?? (asset.folder ? `${normalizeProjectFolderPath(asset.folder)}/${sanitizeProjectFileName(getAssetFileName(asset))}` : asset.url);
  const portableUrl = getPortableAssetPath(asset.url);
  const metadata = {
    ...(asset.metadata ?? {}),
    ...(asset.thumbnail ? { thumbnail: asset.thumbnail } : {}),
  };

  return {
    id: asset.id || `asset-${index + 1}`,
    name: asset.name,
    kind: PROJECT_ASSET_TYPE_TO_KIND[asset.type],
    path: portablePath,
    url: portableUrl ?? (asset.path ? portablePath : asset.url),
    tags: Array.isArray(asset.metadata?.tags)
      ? asset.metadata.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    metadata,
  };
};

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

  const publicSampleProjectMatch = candidate.match(PUBLIC_SAMPLE_PROJECT_RE);
  if (publicSampleProjectMatch?.[1]) return publicSampleProjectMatch[1];

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

  const resolvedDocument = resolved as PixlProjectDocument;

  if (options.directory || options.assetBaseUrl) {
    resolvedDocument.assets = {
      ...resolvedDocument.assets,
      entries: await Promise.all((resolvedDocument.assets.entries ?? []).map(async (entry) => {
        if (entry.url || !entry.path) return entry;
        const url = options.directory
          ? await resolveProjectPathToObjectUrl(options.directory, entry.path)
          : options.assetBaseUrl
            ? joinUrl(options.assetBaseUrl, entry.path)
            : null;
        return url ? { ...entry, url } : entry;
      })),
    };
  }

  return resolvedDocument;
};

export const makeProjectDocumentPortable = (document: PixlProjectDocument): PixlProjectDocument => (
  transformProjectAssetReferencesSync(document, (projectPath) => projectPath) as PixlProjectDocument
);

export const createProjectDocumentContentSignature = (document: PixlProjectDocument): string => {
  const comparable = cloneJson(document);
  comparable.savedAt = 0;
  return JSON.stringify(comparable);
};

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

export interface ImportedProjectAssetFile {
  name: string;
  url: string;
  path: string;
  folder: string;
  metadata: Record<string, unknown>;
}

export const ensureProjectAssetFolder = async (folderPath: string): Promise<string> => {
  const normalizedFolder = normalizeProjectFolderPath(folderPath);

  if (!currentProjectDirectory) return normalizedFolder;

  const permitted = await ensurePermission(currentProjectDirectory);
  if (!permitted) {
    throw new Error('Permissao negada para criar pasta de asset no projeto.');
  }

  await ensureProjectDirectoryPath(currentProjectDirectory, normalizedFolder);
  return normalizedFolder;
};

export const importProjectAssetFiles = async (
  files: File[],
  folderPath: string,
): Promise<ImportedProjectAssetFile[]> => {
  const normalizedFolder = normalizeProjectFolderPath(folderPath);

  if (!currentProjectDirectory) {
    return files.map((file) => {
      const path = `${normalizedFolder}/${sanitizeProjectFileName(file.name)}`;
      return {
        name: file.name,
        url: URL.createObjectURL(file),
        path,
        folder: normalizedFolder,
        metadata: {
          format: file.name.split('.').pop()?.toLowerCase() || '',
          size: file.size,
          projectPath: path,
          transient: true,
        },
      };
    });
  }

  const permitted = await ensurePermission(currentProjectDirectory);
  if (!permitted) {
    throw new Error('Permissao negada para importar assets na pasta do projeto.');
  }

  await ensureProjectDirectoryPath(currentProjectDirectory, normalizedFolder);

  return Promise.all(files.map(async (file) => {
    const path = await getAvailableProjectFilePath(currentProjectDirectory!, normalizedFolder, file.name);
    await writeProjectFile(currentProjectDirectory!, path, file);
    const url = await resolveProjectPathToObjectUrl(currentProjectDirectory!, path);

    return {
      name: file.name,
      url: url ?? path,
      path,
      folder: normalizedFolder,
      metadata: {
        format: file.name.split('.').pop()?.toLowerCase() || '',
        size: file.size,
        projectPath: path,
      },
    };
  }));
};

export const moveProjectAssetToFolder = async (
  asset: ProjectAsset,
  folderPath: string,
): Promise<Pick<ProjectAsset, 'url' | 'path' | 'folder' | 'metadata'>> => {
  const normalizedFolder = normalizeProjectFolderPath(folderPath);
  const sourcePath = getProjectAssetPathFromAsset(asset);
  const fileName = sanitizeProjectFileName(sourcePath?.split('/').pop() || getAssetFileName(asset));
  const fallbackPath = `${normalizedFolder}/${fileName}`;

  if (!sourcePath || !currentProjectDirectory) {
    return {
      url: asset.url,
      path: fallbackPath,
      folder: normalizedFolder,
      metadata: {
        ...(asset.metadata ?? {}),
        projectPath: fallbackPath,
      },
    };
  }

  const currentFolder = sourcePath.split('/').slice(0, -1).join('/');
  if (normalizeProjectFolderPath(currentFolder) === normalizedFolder) {
    return {
      url: asset.url,
      path: sourcePath,
      folder: normalizedFolder,
      metadata: {
        ...(asset.metadata ?? {}),
        projectPath: sourcePath,
      },
    };
  }

  const permitted = await ensurePermission(currentProjectDirectory);
  if (!permitted) {
    throw new Error('Permissao negada para mover asset dentro do projeto.');
  }

  const sourceHandle = await resolveFileHandle(currentProjectDirectory, sourcePath.split('/'));
  const sourceFile = await sourceHandle.getFile();
  const targetPath = await getAvailableProjectFilePath(currentProjectDirectory, normalizedFolder, fileName);
  await writeProjectFile(currentProjectDirectory, targetPath, sourceFile);
  await removeProjectFile(currentProjectDirectory, sourcePath);
  const url = await resolveProjectPathToObjectUrl(currentProjectDirectory, targetPath);

  return {
    url: url ?? targetPath,
    path: targetPath,
    folder: normalizedFolder,
    metadata: {
      ...(asset.metadata ?? {}),
      projectPath: targetPath,
    },
  };
};

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
    activeSceneKind,
    currentTemplateId,
    gameScript,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
  } = useEditorStore.getState();
  const projectAssets = useAssetStore.getState().projectAssets;

  const now = Date.now();
  const stateDocument = createProjectDocumentFromEditorState({
    objects,
    currentTemplateId,
    gameScript,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
    activeSceneKind,
  }, {
    id: currentProjectDocument?.id,
    name: name || currentProjectDocument?.name,
    slug: currentProjectDocument?.slug,
    createdAt: currentProjectDocument?.createdAt,
    savedAt: now,
  });

  if (!currentProjectDocument) {
    const projectAssetEntries = projectAssets.map(projectAssetToManifestEntry);
    const entriesByKey = new Map<string, PixlAssetEntry>();
    [...stateDocument.assets.entries, ...projectAssetEntries].forEach((entry) => {
      entriesByKey.set(entry.path || entry.url || entry.id, { ...entry });
    });
    return {
      ...stateDocument,
      assets: {
        ...stateDocument.assets,
        folders: [
          ...new Set([
            ...stateDocument.assets.folders,
            ...projectAssets.map((asset) => normalizeProjectFolderPath(asset.folder)),
          ]),
        ],
        entries: [...entriesByKey.values()],
      },
    };
  }

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
  const projectAssetEntries = projectAssets.map(projectAssetToManifestEntry);

  [
    ...(currentProjectDocument.assets?.entries ?? []),
    ...(stateDocument.assets.entries ?? []),
    ...projectAssetEntries,
  ].forEach((entry) => {
    const key = entry.path || entry.url || entry.id;
    entriesByKey.set(key, { ...entry });
  });
  const folders = new Set([
    ...(currentProjectDocument.assets?.folders?.length
      ? currentProjectDocument.assets.folders
      : stateDocument.assets.folders),
    ...projectAssets.map((asset) => normalizeProjectFolderPath(asset.folder)),
  ]);

  return {
    ...cloneJson(currentProjectDocument),
    name: name?.trim() || currentProjectDocument.name,
    savedAt: now,
    activeSceneId,
    scenes,
    assets: {
      root: currentProjectDocument.assets?.root ?? stateDocument.assets.root,
      folders: [...folders],
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

export interface ActiveProjectDocumentSnapshot {
  document: PixlProjectDocument;
  signature: string;
  workspace: LocalProjectWorkspace;
}

export const createActiveProjectDocumentSnapshot = (name = 'Untitled Project'): ActiveProjectDocumentSnapshot => {
  const document = createProjectDocumentFromEditor(name);
  return {
    document,
    signature: createProjectDocumentContentSignature(document),
    workspace: getCurrentProjectWorkspace(),
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
    activeSceneKind: snapshot.activeSceneKind === '2d' ? '2d' : '3d',
    currentTemplateId: snapshot.currentTemplateId,
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

  useViewportStore.getState().setViewportMode(snapshot.activeSceneKind === '2d' ? '2d' : '3d');

  useAssetStore.setState({
    projectAssets: snapshot.projectAssets,
  });

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

const ensureProjectFolders = async (
  directory: FileSystemDirectoryHandle,
  folders: string[] = DEFAULT_PROJECT_FOLDERS,
) => {
  for (const folder of folders) {
    await ensureProjectDirectoryPath(directory, folder);
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

  await ensureProjectFolders(currentProjectDirectory, [
    ...DEFAULT_PROJECT_FOLDERS,
    ...(portableDocument.assets?.folders ?? []),
  ]);
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

import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editorStore';
import { useAssetStore } from '@/stores/assetStore';
import { useProjectStore } from '@/stores/projectStore';
import {
  AnyPixlProjectDocument,
  DEFAULT_PROJECT_FOLDERS,
  PixlVec3,
  PixlProjectDocument,
} from '@/engine/project/schema';
import {
  createEditorSnapshotFromProjectDocument,
  createLegacyEditorSave,
  createProjectDocumentFromEditorState,
  normalizeProjectDocument,
} from '@/engine/project/editorProjectAdapter';

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

export const supportsLocalProjectFolders = () => (
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  typeof window.showDirectoryPicker === 'function'
);

export const getCurrentProjectDirectoryName = () => currentProjectDirectory?.name || null;

export const createProjectDocumentFromEditor = (name = 'Untitled Project'): PixlProjectDocument => {
  const {
    objects,
    currentTemplateId,
    gameScript,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
  } = useEditorStore.getState();

  return createProjectDocumentFromEditorState({
    objects,
    currentTemplateId,
    gameScript,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
  }, {
    name,
  });
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

export const applyProjectDocumentToEditor = (document: AnyPixlProjectDocument) => {
  const project = normalizeProjectDocument(document);
  const snapshot = createEditorSnapshotFromProjectDocument(project);
  const focus = getSceneFocus(snapshot.objects.map((object) => ({
    position: object.position,
    scale: object.scale,
  })));

  useEditorStore.setState({
    objects: snapshot.objects,
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

  localStorage.setItem('pixl-project-document', JSON.stringify(project));
  localStorage.setItem('pixl-project-save', JSON.stringify(createLegacyEditorSave(project)));
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

export const saveProjectDocumentToDirectory = async (document: PixlProjectDocument) => {
  if (!supportsLocalProjectFolders()) {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = PIXL_PROJECT_FILE;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Projeto exportado como arquivo JSON.');
    return;
  }

  if (!currentProjectDirectory) {
    currentProjectDirectory = await window.showDirectoryPicker!({
      id: 'pixlplayground-project',
      mode: 'readwrite',
    });
  }

  const permitted = await ensurePermission(currentProjectDirectory);
  if (!permitted) {
    throw new Error('Permissao negada para salvar na pasta do projeto.');
  }

  await ensureProjectFolders(currentProjectDirectory);
  const fileHandle = await currentProjectDirectory.getFileHandle(PIXL_PROJECT_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(document, null, 2));
  await writable.close();

  localStorage.setItem('pixl-project-document', JSON.stringify(document));
  localStorage.setItem('pixl-project-save', JSON.stringify(createLegacyEditorSave(document)));
};

export const openProjectDocumentFromDirectory = async () => {
  if (!supportsLocalProjectFolders()) {
    throw new Error('Seu navegador atual nao permite abrir pastas. Use Chrome/Edge ou a futura versao desktop.');
  }

  const directory = await window.showDirectoryPicker!({
    id: 'pixlplayground-project',
    mode: 'readwrite',
  });
  const fileHandle = await directory.getFileHandle(PIXL_PROJECT_FILE);
  const file = await fileHandle.getFile();
  const document = normalizeProjectDocument(JSON.parse(await file.text()) as AnyPixlProjectDocument);

  currentProjectDirectory = directory;
  applyProjectDocumentToEditor(document);

  return {
    directory,
    document,
  };
};

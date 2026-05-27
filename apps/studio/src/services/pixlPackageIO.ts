// Browser-side IO for .pixl packages. Uses @pixlland/engine-core for the
// actual pack/unpack and the File System Access API for save/open dialogs.
//
// MVP scope (Phase 1.C): one-file projects (just project.pixlproject.json).
// Phase 1.D promotes asset reads to an OPFS-backed scratch folder so .pixl
// archives carrying Assets/Scenes/Scripts/... can serve them to the runtime
// preview iframe via Blob URLs.

import {
  PIXL_PROJECT_DOCUMENT_PATH,
  packProject,
  readManifestFromPackage,
  unpackPackage,
  type PixlPackageManifest,
} from '@pixlland/engine-core';
import { toast } from 'sonner';

import {
  applyProjectDocumentToEditor,
  createActiveProjectDocumentSnapshot,
} from './localProjectFiles';
import { withFilePicker } from './filePickerLock';
import type { AnyPixlProjectDocument } from '@/engine/project/schema';

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();

interface FilePickerAcceptType {
  description: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

const PIXL_PICKER_TYPE: FilePickerAcceptType = {
  description: 'PixlPlayground Package',
  accept: { 'application/zip': ['.pixl'] },
};

export const supportsPixlPackagePicker = (): boolean => (
  typeof window !== 'undefined' &&
  typeof window.showOpenFilePicker === 'function' &&
  typeof window.showSaveFilePicker === 'function'
);

const slugifyProjectName = (name: string): string => (
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    || 'pixl-project'
);

export const saveCurrentProjectAsPixl = async (projectName: string): Promise<PixlPackageManifest> => (
  withFilePicker('save .pixl', async () => {
    const { document } = createActiveProjectDocumentSnapshot(projectName);
    const projectDocBytes = TEXT_ENCODER.encode(JSON.stringify(document, null, 2));
    const { bytes, manifest } = await packProject({
      files: [{ path: PIXL_PROJECT_DOCUMENT_PATH, bytes: projectDocBytes }],
    });

    const suggestedName = `${slugifyProjectName(document.name || projectName)}.pixl`;

    if (supportsPixlPackagePicker()) {
      const handle = await window.showSaveFilePicker!({
        suggestedName,
        types: [PIXL_PICKER_TYPE],
      });
      const writable = await (handle as unknown as { createWritable: () => Promise<{ write: (data: Uint8Array) => Promise<void>; close: () => Promise<void> }> }).createWritable();
      await writable.write(bytes);
      await writable.close();
      return manifest;
    }

    // Fallback: anchor download.
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
    return manifest;
  })
);

const requireOpenFilePicker = async (): Promise<File> => {
  if (supportsPixlPackagePicker()) {
    const [handle] = await window.showOpenFilePicker!({
      multiple: false,
      types: [PIXL_PICKER_TYPE],
    });
    return handle.getFile();
  }

  // Fallback: <input type=file> dialog.
  return new Promise<File>((resolve, reject) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = '.pixl,application/zip';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('Pixl: nenhum arquivo selecionado.'));
      }
    };
    input.click();
  });
};

export interface OpenedPixlPackage {
  manifest: PixlPackageManifest;
  document: AnyPixlProjectDocument;
}

export const openPixlPackageFromDisk = async (): Promise<OpenedPixlPackage> => (
  withFilePicker('open .pixl', async () => {
    const file = await requireOpenFilePicker();
    const buffer = await file.arrayBuffer();
    const { manifest, files } = await unpackPackage(new Uint8Array(buffer));

    const projectFile = files.find((entry) => entry.path === PIXL_PROJECT_DOCUMENT_PATH);
    if (!projectFile) {
      throw new Error('Pixl: arquivo .pixl não contém project.pixlproject.json.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(TEXT_DECODER.decode(projectFile.bytes));
    } catch (error) {
      throw new Error(`Pixl: project.pixlproject.json inválido (${(error as Error).message}).`);
    }

    applyProjectDocumentToEditor(parsed as AnyPixlProjectDocument);
    return { manifest, document: parsed as AnyPixlProjectDocument };
  })
);

export const inspectPixlPackageHeader = async (file: File): Promise<PixlPackageManifest> => {
  const buffer = await file.arrayBuffer();
  return readManifestFromPackage(new Uint8Array(buffer));
};

export const announcePixlOpen = (manifest: PixlPackageManifest): void => {
  toast.success(`Aberto .pixl: ${manifest.projectName}`);
};

export const announcePixlSave = (manifest: PixlPackageManifest): void => {
  toast.success(`Salvo .pixl: ${manifest.projectName}`);
};

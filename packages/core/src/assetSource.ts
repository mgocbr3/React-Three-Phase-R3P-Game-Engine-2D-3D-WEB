// Adapted from tools/vendor/three-game-engine/src/assets/Asset.ts and
// AssetStore.ts (MIT, WesUnwin/three-game-engine). The dual-source pattern
// (string baseURL OR FileSystemDirectoryHandle) is the foundation of the
// .pixl runtime preview: when the project came from an OPFS-unpacked .pixl,
// runtimePreview.ts feeds the iframe Object URLs minted off the dir handle;
// when it came from a dev server, the same code path uses fetch URLs.

export type AssetSourceInput = string | FileSystemDirectoryHandle;

export interface AssetSource {
  readonly kind: 'url' | 'directory';
  readonly baseURL: string | null;
  readonly dirHandle: FileSystemDirectoryHandle | null;
  resolve(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  list(path?: string): AsyncIterable<{ path: string; size: number }>;
  unload(): void;
}

const stripTrailingSlash = (value: string): string => (
  value.endsWith('/') ? value.slice(0, -1) : value
);

const splitPathSegments = (path: string): string[] => {
  const trimmed = path.replace(/^\/+/, '');
  if (!trimmed) return [];
  return trimmed.split('/').filter((segment) => segment.length > 0);
};

// Adapted directly from Wes' Asset.getFileAtPath.
const getFileAtPath = async (
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<File> => {
  const segments = splitPathSegments(path);
  if (segments.length === 0) {
    throw new Error(`Pixl asset source: empty path`);
  }

  let directory = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    directory = await directory.getDirectoryHandle(segments[i]);
  }
  const fileHandle = await directory.getFileHandle(segments[segments.length - 1]);
  return fileHandle.getFile();
};

// FileSystemDirectoryHandle exposes async iteration via Symbol.asyncIterator
// in modern browsers (Chrome 88+, Firefox 111+, Safari 15.2+). The DOM types
// shipping with TS 5.x don't model `entries()` on the interface yet — work
// around with a narrowed local type. Behavior is the spec'd one.
type DirectoryEntriesIterator = AsyncIterable<[string, FileSystemHandle]>;

const iterateDirectoryEntries = (
  directory: FileSystemDirectoryHandle,
): DirectoryEntriesIterator => {
  const candidate = directory as unknown as {
    entries?: () => DirectoryEntriesIterator;
    [Symbol.asyncIterator]?: () => AsyncIterator<[string, FileSystemHandle]>;
  };
  if (typeof candidate.entries === 'function') {
    return candidate.entries();
  }
  if (typeof candidate[Symbol.asyncIterator] === 'function') {
    return candidate as DirectoryEntriesIterator;
  }
  throw new Error(
    'Pixl asset source: FileSystemDirectoryHandle is not iterable in this runtime.',
  );
};

const walkDirectory = async function* (
  root: FileSystemDirectoryHandle,
  prefix: string,
): AsyncGenerator<{ path: string; size: number }> {
  for await (const [name, handle] of iterateDirectoryEntries(root)) {
    const childPath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      yield { path: childPath, size: file.size };
    } else if (handle.kind === 'directory') {
      yield* walkDirectory(handle as FileSystemDirectoryHandle, childPath);
    }
  }
};

class UrlAssetSource implements AssetSource {
  readonly kind = 'url' as const;
  readonly baseURL: string;
  readonly dirHandle = null;

  constructor(baseURL: string) {
    this.baseURL = stripTrailingSlash(baseURL);
  }

  async resolve(path: string): Promise<string> {
    return `${this.baseURL}/${path.replace(/^\/+/, '')}`;
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const response = await fetch(await this.resolve(path));
    if (!response.ok) {
      throw new Error(`Pixl asset source (url): GET ${path} -> ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async readText(path: string): Promise<string> {
    const response = await fetch(await this.resolve(path));
    if (!response.ok) {
      throw new Error(`Pixl asset source (url): GET ${path} -> ${response.status}`);
    }
    return response.text();
  }

  async *list(): AsyncIterable<{ path: string; size: number }> {
    // URL sources cannot enumerate without a manifest. Callers should rely on
    // project.pixlproject.json + manifest.pixl.json for the file list.
  }

  unload(): void {
    // Nothing to release.
  }
}

class DirectoryAssetSource implements AssetSource {
  readonly kind = 'directory' as const;
  readonly baseURL = null;
  readonly dirHandle: FileSystemDirectoryHandle;
  private readonly objectUrls = new Map<string, string>();

  constructor(dirHandle: FileSystemDirectoryHandle) {
    this.dirHandle = dirHandle;
  }

  async resolve(path: string): Promise<string> {
    const cached = this.objectUrls.get(path);
    if (cached) return cached;
    const file = await getFileAtPath(this.dirHandle, path);
    const url = URL.createObjectURL(file);
    this.objectUrls.set(path, url);
    return url;
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const file = await getFileAtPath(this.dirHandle, path);
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async readText(path: string): Promise<string> {
    const file = await getFileAtPath(this.dirHandle, path);
    return file.text();
  }

  list(path = ''): AsyncIterable<{ path: string; size: number }> {
    return walkDirectory(this.dirHandle, path);
  }

  unload(): void {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
  }
}

export const createAssetSource = (input: AssetSourceInput): AssetSource => {
  if (typeof input === 'string') {
    return new UrlAssetSource(input);
  }
  const FS = (globalThis as { FileSystemDirectoryHandle?: unknown }).FileSystemDirectoryHandle;
  if (typeof FS === 'function' && !(input instanceof (FS as { new (): unknown }))) {
    throw new Error('Pixl asset source: directory handle must be a FileSystemDirectoryHandle.');
  }
  return new DirectoryAssetSource(input);
};

// Manifest schema for a .pixl package. The contract is the hash list:
// repacking a project produces the same .pixl iff nothing changed.
//
// Pixlland-specific addition on top of three-game-engine — Wes' game.json
// describes contents; this manifest describes packaging.

export const PIXL_PACKAGE_FORMAT = 'pixl-package' as const;
export const PIXL_PACKAGE_FORMAT_VERSION = 1 as const;
export const PIXL_PACKAGE_MANIFEST_PATH = 'manifest.pixl.json' as const;
export const PIXL_PROJECT_DOCUMENT_PATH = 'project.pixlproject.json' as const;

export interface PixlPackageFileEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface PixlPackageManifest {
  format: typeof PIXL_PACKAGE_FORMAT;
  formatVersion: typeof PIXL_PACKAGE_FORMAT_VERSION;
  engine: {
    name: string;
    version: string;
    schemaVersion: number;
  };
  runtime: {
    primary: string;
    renderers: string[];
    physics: string[];
  };
  projectId: string;
  projectName: string;
  projectSlug: string;
  createdAt: number;
  packedAt: number;
  contentHash: string;
  files: PixlPackageFileEntry[];
}

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every((item) => typeof item === 'string')
);

const isFileEntry = (value: unknown): value is PixlPackageFileEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<PixlPackageFileEntry>;
  return (
    typeof entry.path === 'string' &&
    typeof entry.size === 'number' &&
    typeof entry.sha256 === 'string'
  );
};

const isManifestEngineBlock = (value: unknown): value is PixlPackageManifest['engine'] => {
  if (!value || typeof value !== 'object') return false;
  const block = value as Partial<PixlPackageManifest['engine']>;
  return (
    typeof block.name === 'string' &&
    typeof block.version === 'string' &&
    typeof block.schemaVersion === 'number'
  );
};

const isManifestRuntimeBlock = (value: unknown): value is PixlPackageManifest['runtime'] => {
  if (!value || typeof value !== 'object') return false;
  const block = value as Partial<PixlPackageManifest['runtime']>;
  return (
    typeof block.primary === 'string' &&
    isStringArray(block.renderers) &&
    isStringArray(block.physics)
  );
};

export const isPixlPackageManifest = (value: unknown): value is PixlPackageManifest => {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<PixlPackageManifest>;
  return (
    manifest.format === PIXL_PACKAGE_FORMAT &&
    manifest.formatVersion === PIXL_PACKAGE_FORMAT_VERSION &&
    typeof manifest.contentHash === 'string' &&
    typeof manifest.projectId === 'string' &&
    typeof manifest.projectName === 'string' &&
    typeof manifest.projectSlug === 'string' &&
    typeof manifest.createdAt === 'number' &&
    typeof manifest.packedAt === 'number' &&
    Array.isArray(manifest.files) &&
    manifest.files.every(isFileEntry) &&
    isManifestEngineBlock(manifest.engine) &&
    isManifestRuntimeBlock(manifest.runtime)
  );
};

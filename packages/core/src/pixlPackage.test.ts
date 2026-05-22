import { describe, expect, it } from 'vitest';

import {
  PIXL_PACKAGE_FORMAT,
  PIXL_PACKAGE_FORMAT_VERSION,
  PIXL_PACKAGE_MANIFEST_PATH,
  PIXL_PROJECT_DOCUMENT_PATH,
} from './manifest.js';
import {
  packProject,
  readManifestFromPackage,
  unpackPackage,
} from './pixlPackage.js';

const enc = new TextEncoder();

const makeProjectDoc = (overrides: Record<string, unknown> = {}) => {
  const base = {
    format: 'pixlplayground-project',
    version: 2,
    id: 'pixl-test-project',
    slug: 'test-project',
    name: 'Test Project',
    createdAt: 1779000000000,
    savedAt: 1779000000000,
    engine: { name: 'PixlPlayground', version: '0.2.0', schemaVersion: 2 },
    runtime: { primary: 'three-3d', renderers: ['three'], physics: ['rapier'] },
    activeSceneId: 'main',
    scenes: [],
    assets: { root: 'Assets', folders: [], entries: [] },
    editor: {
      mode: '3d',
      transformSpace: 'world',
      snapEnabled: true,
      snapTranslate: 0.5,
      snapRotate: 15,
      snapScale: 0.1,
      selectedSceneId: 'main',
    },
    game: { templateId: null, script: '' },
  };
  return enc.encode(JSON.stringify({ ...base, ...overrides }, null, 2));
};

const sampleFiles = (overrides?: { path: string; bytes: Uint8Array }[]) => [
  { path: PIXL_PROJECT_DOCUMENT_PATH, bytes: makeProjectDoc() },
  { path: 'Assets/3D_Models/box.glb', bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
  { path: 'Scenes/main.pixlscene.json', bytes: enc.encode('{"objects":[]}') },
  { path: 'Scripts/player.pixlscript.js', bytes: enc.encode('export const init = () => {};') },
  ...(overrides ?? []),
];

describe('pack/unpack', () => {
  it('produces a manifest with the expected metadata', async () => {
    const { manifest } = await packProject({ files: sampleFiles(), packedAt: 1779100000000 });

    expect(manifest.format).toBe(PIXL_PACKAGE_FORMAT);
    expect(manifest.formatVersion).toBe(PIXL_PACKAGE_FORMAT_VERSION);
    expect(manifest.projectId).toBe('pixl-test-project');
    expect(manifest.projectName).toBe('Test Project');
    expect(manifest.projectSlug).toBe('test-project');
    expect(manifest.createdAt).toBe(1779000000000);
    expect(manifest.packedAt).toBe(1779100000000);
    expect(manifest.engine.schemaVersion).toBe(2);
    expect(manifest.runtime.primary).toBe('three-3d');
    expect(manifest.files.map((f) => f.path)).toEqual([
      'Assets/3D_Models/box.glb',
      'Scenes/main.pixlscene.json',
      'Scripts/player.pixlscript.js',
      PIXL_PROJECT_DOCUMENT_PATH,
    ]);
    expect(manifest.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('round-trips identical content', async () => {
    const original = sampleFiles();
    const { bytes } = await packProject({ files: original, packedAt: 1779100000000 });
    const { manifest, files } = await unpackPackage(bytes);

    expect(manifest.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(files.length).toBe(original.length);
    for (const expected of original) {
      const actual = files.find((f) => f.path === expected.path);
      expect(actual, `missing ${expected.path}`).toBeDefined();
      expect(actual!.bytes).toEqual(expected.bytes);
    }
  });

  it('packs deterministically (same input -> same bytes)', async () => {
    const files = sampleFiles();
    const a = await packProject({ files, packedAt: 1779100000000 });
    const b = await packProject({ files, packedAt: 1779100000000 });
    expect(a.bytes).toEqual(b.bytes);
    expect(a.manifest.contentHash).toBe(b.manifest.contentHash);
  });

  it('detects content changes via the contentHash', async () => {
    const a = await packProject({ files: sampleFiles(), packedAt: 1779100000000 });
    const tampered = sampleFiles([
      { path: 'Assets/3D_Models/box.glb', bytes: new Uint8Array([99, 99, 99]) },
    ]);
    // Remove the original box so the tampered entry takes its place.
    const dedup = new Map(tampered.map((f) => [f.path, f]));
    const b = await packProject({ files: [...dedup.values()], packedAt: 1779100000000 });

    expect(a.manifest.contentHash).not.toBe(b.manifest.contentHash);
  });

  it('refuses to pack without the project document', async () => {
    const files = sampleFiles().filter((f) => f.path !== PIXL_PROJECT_DOCUMENT_PATH);
    await expect(packProject({ files })).rejects.toThrow(/project.pixlproject.json/);
  });

  it('refuses to pack when the input already contains manifest.pixl.json', async () => {
    const files = [
      ...sampleFiles(),
      { path: PIXL_PACKAGE_MANIFEST_PATH, bytes: enc.encode('{"format":"pixl-package"}') },
    ];
    await expect(packProject({ files })).rejects.toThrow(/manifest.pixl.json/);
  });

  it('rejects an archive whose contents do not match the manifest', async () => {
    const { bytes } = await packProject({ files: sampleFiles(), packedAt: 1779100000000 });

    // Naive corruption: flip a single byte deep in the archive. This will
    // almost certainly corrupt a file payload (manifest is at the very start
    // of the zip so we pick an offset past it).
    const corrupted = new Uint8Array(bytes);
    const offset = Math.floor(corrupted.length * 0.7);
    corrupted[offset] = (corrupted[offset] + 1) % 256;

    await expect(unpackPackage(corrupted)).rejects.toThrow();
  });

  it('readManifestFromPackage reads metadata without verifying file hashes', async () => {
    const { bytes, manifest } = await packProject({ files: sampleFiles(), packedAt: 1779100000000 });
    const header = await readManifestFromPackage(bytes);
    expect(header.contentHash).toBe(manifest.contentHash);
    expect(header.projectName).toBe('Test Project');
  });
});

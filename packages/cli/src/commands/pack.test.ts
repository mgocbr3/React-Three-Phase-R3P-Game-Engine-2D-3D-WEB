import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readBytesFromFile, readProjectFolder } from '@pixlland/engine-core/node';

import { runInspect, runPack, runUnpack } from './pack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
const harvestProjectDir = path.join(
  repoRoot,
  'apps',
  'portal',
  'games-src',
  'harvest-rush-3d',
  'pixlplayground',
);
const describeWithHarvestFixture = existsSync(harvestProjectDir) ? describe : describe.skip;

let workdir = '';

beforeEach(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'pixl-pack-'));
});

afterEach(() => {
  if (workdir && existsSync(workdir)) {
    rmSync(workdir, { recursive: true, force: true });
  }
});

describeWithHarvestFixture('cli pack / unpack', () => {
  it('packs the Harvest Rush 3D project into a .pixl with a valid manifest', async () => {
    const outFile = path.join(workdir, 'harvest-rush.pixl');
    const result = await runPack(harvestProjectDir, outFile);

    expect(result.outPath).toBe(outFile);
    expect(result.archiveSize).toBeGreaterThan(0);
    expect(result.manifest.projectSlug).toBe('harvest-rush-3d');
    expect(result.manifest.runtime.primary).toBe('three-3d');
    expect(result.manifest.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.manifest.files.length).toBeGreaterThan(0);
  });

  it('unpacks the same .pixl back to a project folder, verifying hashes', async () => {
    const outFile = path.join(workdir, 'harvest-rush.pixl');
    const restoreDir = path.join(workdir, 'restore');

    const packed = await runPack(harvestProjectDir, outFile);
    const unpacked = await runUnpack(outFile, restoreDir);

    expect(unpacked.manifest.contentHash).toBe(packed.manifest.contentHash);
    expect(unpacked.fileCount).toBe(packed.manifest.files.length);
  });

  it('produces a deterministic .pixl byte stream (same input -> same archive)', async () => {
    const a = path.join(workdir, 'a.pixl');
    const b = path.join(workdir, 'b.pixl');
    // Use the same packedAt so the manifest is byte-identical.
    const packedAt = 1779100000000;
    await runPack(harvestProjectDir, a, { packedAt });
    await runPack(harvestProjectDir, b, { packedAt });

    const bytesA = await readBytesFromFile(a);
    const bytesB = await readBytesFromFile(b);
    expect(bytesA.byteLength).toBe(bytesB.byteLength);
    expect(bytesA).toEqual(bytesB);
  });

  it('inspect reads the manifest header without touching file payloads', async () => {
    const outFile = path.join(workdir, 'harvest-rush.pixl');
    await runPack(harvestProjectDir, outFile);

    const manifest = await runInspect(outFile);
    expect(manifest.projectSlug).toBe('harvest-rush-3d');
  });

  it('re-pack of the unpacked project yields the same contentHash', async () => {
    const out1 = path.join(workdir, 'pack-1.pixl');
    const restoreDir = path.join(workdir, 'restore');
    const out2 = path.join(workdir, 'pack-2.pixl');

    const packed = await runPack(harvestProjectDir, out1, { packedAt: 1779100000000 });
    await runUnpack(out1, restoreDir);

    // The original project folder hash should match a pack of the unpacked one.
    const restored = await readProjectFolder(restoreDir);
    expect(restored.length).toBe(packed.manifest.files.length);

    const repacked = await runPack(restoreDir, out2, { packedAt: 1779100000000 });
    expect(repacked.manifest.contentHash).toBe(packed.manifest.contentHash);
  });
});

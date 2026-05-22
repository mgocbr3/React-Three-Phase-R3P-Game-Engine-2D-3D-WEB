import { stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, describe, expect, it } from 'vitest';

import { captureEvents, resetGlobalState, usingFixture } from '../../testHelpers.js';
import { packProject } from './pack.js';
import { unpackProject } from './unpack.js';

describe('project.pack / unpack', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('empacota um projeto válido e emite project.packed', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const outPath = path.join(tmpdir(), `pixl-pack-${Date.now()}.pixl`);
      const { events, stop } = captureEvents();
      const result = await packProject(
        { projectDir: dir, agent: 'cli' },
        { outPath, packedAt: 1700000000001 },
      );
      expect(result.ok).toBe(true);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      const fileStat = await stat(outPath);
      expect(fileStat.size).toBeGreaterThan(100);
      expect(events.some((e) => e.type === 'project.packed')).toBe(true);
      stop();
    });
  });

  it('recusa quando outPath está vazio', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await packProject(
        { projectDir: dir, agent: 'cli' },
        { outPath: '' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('round-trip pack/unpack reproduz o doc', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const outPath = path.join(tmpdir(), `pixl-rt-${Date.now()}.pixl`);
      await packProject(
        { projectDir: dir, agent: 'cli' },
        { outPath, packedAt: 1700000000002 },
      );
      const restoredDir = path.join(tmpdir(), `pixl-restored-${Date.now()}`);
      const result = await unpackProject(
        { projectDir: restoredDir, agent: 'cli' },
        { sourcePath: outPath },
      );
      expect(result.ok).toBe(true);
      expect(result.changedFiles.some((f) => f.endsWith('project.pixlproject.json'))).toBe(true);
    });
  });

  it('unpack falha quando o source não existe', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await unpackProject(
        { projectDir: dir, agent: 'cli' },
        { sourcePath: '/tmp/__nonexistent.pixl' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { captureEvents, resetGlobalState, usingFixture } from '../../testHelpers.js';
import { deleteScript } from './delete.js';
import { readScript } from './read.js';
import { writeScript } from './write.js';

describe('script.write', () => {
  beforeEach(() => resetGlobalState());

  it('escreve um script novo e emite script.written', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const { events, stop } = captureEvents();
      const result = await writeScript(
        { projectDir: dir, agent: 'editor' },
        { path: 'foo.js', source: 'export const x = 1;\n' },
      );
      expect(result.ok).toBe(true);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      const onDisk = await readFile(path.join(dir, 'Scripts', 'foo.js'), 'utf8');
      expect(onDisk).toContain('export const x');
      expect(events[0].type).toBe('script.written');
      stop();
    });
  });

  it('aceita o prefixo "Scripts/" explícito sem duplicar a pasta', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await writeScript(
        { projectDir: dir, agent: 'editor' },
        { path: 'Scripts/sub/bar.js', source: 'hi\n' },
      );
      expect(result.ok).toBe(true);
      const onDisk = await readFile(path.join(dir, 'Scripts', 'sub', 'bar.js'), 'utf8');
      expect(onDisk).toBe('hi\n');
    });
  });

  it('rejeita path tentando escapar com ".."', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await writeScript(
        { projectDir: dir, agent: 'editor' },
        { path: '../../etc/passwd', source: 'nope' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita path absoluto', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await writeScript(
        { projectDir: dir, agent: 'editor' },
        { path: '/etc/passwd', source: 'nope' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe('script.read', () => {
  beforeEach(() => resetGlobalState());

  it('lê um script existente', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await mkdir(path.join(dir, 'Scripts'), { recursive: true });
      await writeFile(path.join(dir, 'Scripts', 'a.js'), 'console.log(42);\n', 'utf8');
      const result = await readScript({ projectDir: dir, agent: 'editor' }, { path: 'a.js' });
      expect(result.ok).toBe(true);
      expect(result.source).toBe('console.log(42);\n');
    });
  });

  it('retorna ok=false quando o script não existe', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await readScript({ projectDir: dir, agent: 'editor' }, { path: 'never.js' });
      expect(result.ok).toBe(false);
      expect(result.source).toBeNull();
    });
  });

  it('rejeita path traversal', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await readScript(
        { projectDir: dir, agent: 'editor' },
        { path: '../../secret' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe('script.delete', () => {
  beforeEach(() => resetGlobalState());

  it('deleta um script existente', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await writeScript({ projectDir: dir, agent: 'test' }, { path: 'gone.js', source: 'x' });
      const result = await deleteScript(
        { projectDir: dir, agent: 'editor' },
        { path: 'gone.js' },
      );
      expect(result.ok).toBe(true);
    });
  });

  it('retorna ok=false quando o script não existe', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await deleteScript(
        { projectDir: dir, agent: 'editor' },
        { path: 'nope.js' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita path traversal', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await deleteScript(
        { projectDir: dir, agent: 'editor' },
        { path: '../foo' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

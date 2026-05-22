import { beforeEach, describe, expect, it } from 'vitest';

import { captureEvents, resetGlobalState, usingFixture } from '../../testHelpers.js';
import { exportPhaser } from './exportPhaser.js';
import { exportPixlland } from './exportPixlland.js';
import { exportThree } from './exportThree.js';

describe('build.export* (stubs)', () => {
  beforeEach(() => resetGlobalState());

  it('exportThree retorna ok=false com mensagem de "não implementado"', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const { events, stop } = captureEvents();
      const result = await exportThree({ projectDir: dir, agent: 'cli' }, { outDir: '/tmp/x' });
      expect(result.ok).toBe(false);
      expect(result.validationErrors.join(' ')).toMatch(/não implementado/);
      expect(events.some((e) => e.type === 'build.completed' && e.target === 'three-web')).toBe(true);
      stop();
    });
  });

  it('exportPhaser retorna ok=false e emite build.completed(target=phaser-web)', async () => {
    await usingFixture({ kind: '2d' }, async (dir) => {
      const { events, stop } = captureEvents();
      const result = await exportPhaser({ projectDir: dir, agent: 'cli' }, { outDir: '/tmp/x' });
      expect(result.ok).toBe(false);
      expect(events.some((e) => e.type === 'build.completed' && e.target === 'phaser-web')).toBe(true);
      stop();
    });
  });

  it('exportPixlland retorna ok=false e emite build.completed(target=pixlland)', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const { events, stop } = captureEvents();
      const result = await exportPixlland({ projectDir: dir, agent: 'cli' }, { outDir: '/tmp/x' });
      expect(result.ok).toBe(false);
      expect(events.some((e) => e.type === 'build.completed' && e.target === 'pixlland')).toBe(true);
      stop();
    });
  });

  it('os três stubs não modificam o documento on-disk', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const before = (await import('node:fs')).promises.readFile(
        `${dir}/project.pixlproject.json`, 'utf8',
      );
      await exportThree({ projectDir: dir, agent: 'cli' }, { outDir: '/tmp' });
      await exportPhaser({ projectDir: dir, agent: 'cli' }, { outDir: '/tmp' });
      await exportPixlland({ projectDir: dir, agent: 'cli' }, { outDir: '/tmp' });
      const after = (await import('node:fs')).promises.readFile(
        `${dir}/project.pixlproject.json`, 'utf8',
      );
      expect(await after).toBe(await before);
    });
  });
});

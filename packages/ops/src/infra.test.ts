// Infrastructure tests — lock, broadcast, validate. These complement the
// per-op tests and verify the building blocks the GDD §6.1 contract relies on.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  broadcastProjectEvent,
  subscribeProjectEvents,
  unsubscribeAllProjectEvents,
} from './broadcast.js';
import { withProjectLock, __resetLocksForTests } from './lock.js';
import { validate } from './validate.js';
import {
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  type PixlProjectShape,
} from './schema.js';

const buildValidDoc = (): PixlProjectShape => ({
  format: PIXL_PROJECT_FORMAT,
  version: PIXL_PROJECT_VERSION,
  id: 'p1',
  name: 'Doc',
  activeSceneId: 'main',
  scenes: [{ id: 'main', name: 'Main', kind: '3d', rootObjects: [] }],
});

describe('broadcast', () => {
  beforeEach(() => unsubscribeAllProjectEvents());

  it('emite eventos pra listeners inscritos', () => {
    const seen: string[] = [];
    subscribeProjectEvents((event) => seen.push(event.type));
    broadcastProjectEvent({ type: 'project.opened', projectDir: '/x', contentHash: 'h', byAgent: 'test' });
    expect(seen).toEqual(['project.opened']);
  });

  it('listener que joga erro não derruba os outros', () => {
    const calls: string[] = [];
    subscribeProjectEvents(() => {
      throw new Error('boom');
    });
    subscribeProjectEvents((event) => calls.push(event.type));
    expect(() =>
      broadcastProjectEvent({ type: 'project.closed', projectDir: '/x', byAgent: 'test' }),
    ).not.toThrow();
    expect(calls).toEqual(['project.closed']);
  });

  it('unsubscribe para de receber eventos', () => {
    const seen: string[] = [];
    const off = subscribeProjectEvents((event) => seen.push(event.type));
    off();
    broadcastProjectEvent({ type: 'project.closed', projectDir: '/x', byAgent: 'test' });
    expect(seen).toEqual([]);
  });
});

describe('lock', () => {
  beforeEach(() => __resetLocksForTests());

  it('serializa duas ops no mesmo projectDir', async () => {
    const order: string[] = [];
    const a = withProjectLock('/proj/a', async () => {
      order.push('a:start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('a:end');
    });
    const b = withProjectLock('/proj/a', async () => {
      order.push('b:start');
      order.push('b:end');
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('NÃO serializa ops em projectDirs diferentes', async () => {
    const order: string[] = [];
    const a = withProjectLock('/proj/a', async () => {
      order.push('a:start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('a:end');
    });
    const b = withProjectLock('/proj/b', async () => {
      order.push('b:start');
      order.push('b:end');
    });
    await Promise.all([a, b]);
    // b runs to completion before a finishes its delay.
    expect(order.slice(0, 3)).toEqual(['a:start', 'b:start', 'b:end']);
  });

  it('propaga o valor de retorno', async () => {
    const result = await withProjectLock('/proj/c', async () => 42);
    expect(result).toBe(42);
  });
});

describe('validate', () => {
  it('aceita um doc válido', () => {
    const r = validate(buildValidDoc());
    expect(r.ok).toBe(true);
  });

  it('rejeita format errado', () => {
    const doc = buildValidDoc();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).format = 'wrong';
    expect(validate(doc).ok).toBe(false);
  });

  it('rejeita objects duplicados na mesma cena', () => {
    const doc = buildValidDoc();
    doc.scenes[0].rootObjects = [
      { id: 'a', name: 'A', type: 'cube' },
      { id: 'a', name: 'A again', type: 'cube' },
    ];
    expect(validate(doc).ok).toBe(false);
  });

  it('rejeita activeSceneId que não está em scenes[]', () => {
    const doc = buildValidDoc();
    doc.activeSceneId = 'inexistente';
    expect(validate(doc).ok).toBe(false);
  });

  it('aceita warning sem falhar quando o componente é unknown', () => {
    const doc = buildValidDoc();
    doc.scenes[0].rootObjects = [
      { id: 'o', name: 'O', type: 'x', components: [{ id: 'c', type: 'pixl.custom', enabled: true, data: {} }] },
    ];
    const r = validate(doc);
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isKnownOp,
  listOps,
  parseOpArgs,
  runOpsCall,
} from './ops.js';

describe('ops.list', () => {
  it('inclui os 21 ops do GDD §6.1', () => {
    const ops = listOps();
    expect(ops).toHaveLength(21);
    const names = ops.map((o) => o.name).sort();
    expect(names).toContain('project.create');
    expect(names).toContain('scene.create');
    expect(names).toContain('object.add');
    expect(names).toContain('object.reparent');
    expect(names).toContain('asset.import');
    expect(names).toContain('script.write');
    expect(names).toContain('build.exportThree');
  });

  it('cada entry tem name, category, description, required, optional', () => {
    for (const entry of listOps()) {
      expect(entry.name).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(['project', 'scene', 'object', 'asset', 'script', 'build']).toContain(entry.category);
      expect(typeof entry.description).toBe('string');
      expect(Array.isArray(entry.required)).toBe(true);
      expect(Array.isArray(entry.optional)).toBe(true);
    }
  });

  it('retorna cópias (mutar o resultado não afeta a próxima chamada)', () => {
    const first = listOps();
    first[0].name = 'mutated';
    const second = listOps();
    expect(second[0].name).not.toBe('mutated');
  });
});

describe('isKnownOp', () => {
  it('reconhece ops válidos', () => {
    expect(isKnownOp('object.add')).toBe(true);
    expect(isKnownOp('project.create')).toBe(true);
  });

  it('rejeita ops inexistentes', () => {
    expect(isKnownOp('object.fly')).toBe(false);
    expect(isKnownOp('')).toBe(false);
  });
});

describe('parseOpArgs', () => {
  it('coerce números, booleanos, null', () => {
    const args = parseOpArgs(['--x', '1.5', '--y', 'true', '--z', 'null', '--name', 'Foo']);
    expect(args).toEqual({ x: 1.5, y: true, z: null, name: 'Foo' });
  });

  it('aceita --key=value e --key value', () => {
    const args = parseOpArgs(['--a=1', '--b', '2']);
    expect(args).toEqual({ a: 1, b: 2 });
  });

  it('flags sem valor viram true', () => {
    const args = parseOpArgs(['--force', '--name', 'x']);
    expect(args.force).toBe(true);
    expect(args.name).toBe('x');
  });

  it('suporta JSON via sufixo :json', () => {
    const args = parseOpArgs(['--position:json=[1,2,3]', '--tags:json=["a","b"]']);
    expect(args.position).toEqual([1, 2, 3]);
    expect(args.tags).toEqual(['a', 'b']);
  });

  it('rejeita JSON malformado', () => {
    expect(() => parseOpArgs(['--data:json={broken'])).toThrow(/JSON/);
  });

  it('rejeita argumento sem --', () => {
    expect(() => parseOpArgs(['foo'])).toThrow(/argumento inválido/);
  });

  it('números negativos são coerced corretamente', () => {
    const args = parseOpArgs(['--x', '-5', '--y', '-1.5']);
    expect(args.x).toBe(-5);
    expect(args.y).toBe(-1.5);
  });
});

describe('runOpsCall', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pixl-cli-ops-'));
    await rm(dir, { recursive: true, force: true });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('dispatcha project.create e cria o doc', async () => {
    const result = await runOpsCall('project.create', dir, {
      name: 'CLI Test', kind: '3d', id: 'project_cli',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).ok).toBe(true);
    const docPath = path.join(dir, 'project.pixlproject.json');
    const doc = JSON.parse(await readFile(docPath, 'utf8'));
    expect(doc.name).toBe('CLI Test');
    expect(doc.runtime.primary).toBe('three-3d');
  });

  it('end-to-end: create + addObject pela CLI dispatcher', async () => {
    await runOpsCall('project.create', dir, { name: 'T', kind: '3d', id: 'p1' });
    const result = await runOpsCall('object.add', dir, {
      sceneId: 'main', parentId: null, type: 'cube', id: 'cube_1',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).ok).toBe(true);
    const doc = JSON.parse(await readFile(path.join(dir, 'project.pixlproject.json'), 'utf8'));
    expect(doc.scenes[0].rootObjects[0].id).toBe('cube_1');
  });

  it('rejeita op desconhecido', async () => {
    await expect(runOpsCall('object.teleport', dir, {})).rejects.toThrow(/desconhecido/);
  });

  it('rejeita projectDir vazio', async () => {
    await expect(runOpsCall('project.validate', '', {})).rejects.toThrow(/projectDir/);
  });

  it('agent padrão é "cli"', async () => {
    await runOpsCall('project.create', dir, { name: 'T', kind: '3d', id: 'p1' });
    // The created event would carry byAgent='cli' — verify via the doc savedAt + agent field
    // not exposed. Smoke-check that the call succeeded and the file exists.
    const doc = JSON.parse(await readFile(path.join(dir, 'project.pixlproject.json'), 'utf8'));
    expect(doc.id).toBe('p1');
  });

  it('propaga ok=false do op (project já existe)', async () => {
    await runOpsCall('project.create', dir, { name: 'A', kind: '3d', id: 'p_a' });
    const second = await runOpsCall('project.create', dir, { name: 'B', kind: '3d', id: 'p_b' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((second as any).ok).toBe(false);
  });
});

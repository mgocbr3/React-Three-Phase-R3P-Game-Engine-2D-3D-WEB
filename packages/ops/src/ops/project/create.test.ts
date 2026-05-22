import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { createProject } from './create.js';
import { captureEvents, resetGlobalState } from '../../testHelpers.js';
import { PIXL_PROJECT_DOCUMENT_FILENAME } from '../../schema.js';

const newTmp = (): Promise<string> => mkdtemp(path.join(tmpdir(), 'pixl-create-'));

describe('project.create', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('cria um projeto 3D no diretório informado', async () => {
    const dir = await newTmp();
    await rm(dir, { recursive: true, force: true }); // remove so createProject scaffolds
    const { events, stop } = captureEvents();
    const result = await createProject(
      { projectDir: dir, agent: 'test' },
      { name: 'Test 3D', kind: '3d', id: 'project_x' },
    );
    expect(result.ok).toBe(true);
    expect(result.changedFiles).toContain('project.pixlproject.json');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    const raw = await readFile(path.join(dir, PIXL_PROJECT_DOCUMENT_FILENAME), 'utf8');
    const doc = JSON.parse(raw);
    expect(doc.runtime.primary).toBe('three-3d');
    expect(doc.scenes[0].kind).toBe('3d');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('project.created');
    stop();
    await rm(dir, { recursive: true, force: true });
  });

  it('cria um projeto 2D com runtime phaser-2d', async () => {
    const dir = await newTmp();
    await rm(dir, { recursive: true, force: true });
    const result = await createProject(
      { projectDir: dir, agent: 'cli' },
      { name: 'Test 2D', kind: '2d', id: 'project_y' },
    );
    expect(result.ok).toBe(true);
    const doc = JSON.parse(await readFile(path.join(dir, PIXL_PROJECT_DOCUMENT_FILENAME), 'utf8'));
    expect(doc.runtime.primary).toBe('phaser-2d');
    expect(doc.scenes[0].kind).toBe('2d');
    await rm(dir, { recursive: true, force: true });
  });

  it('rejeita name vazio', async () => {
    const dir = await newTmp();
    await rm(dir, { recursive: true, force: true });
    const result = await createProject(
      { projectDir: dir, agent: 'test' },
      { name: '', kind: '3d' },
    );
    expect(result.ok).toBe(false);
    expect(result.validationErrors.join(' ')).toMatch(/name/);
    await rm(dir, { recursive: true, force: true });
  });

  it('rejeita kind inválido', async () => {
    const dir = await newTmp();
    await rm(dir, { recursive: true, force: true });
    const result = await createProject(
      { projectDir: dir, agent: 'test' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { name: 'X', kind: 'voxel' as any },
    );
    expect(result.ok).toBe(false);
    expect(result.validationErrors.join(' ')).toMatch(/kind/);
    await rm(dir, { recursive: true, force: true });
  });

  it('recusa quando o projeto já existe (refuseIfExists default)', async () => {
    const dir = await newTmp();
    await rm(dir, { recursive: true, force: true });
    const first = await createProject(
      { projectDir: dir, agent: 'test' },
      { name: 'A', kind: '3d' },
    );
    expect(first.ok).toBe(true);
    const second = await createProject(
      { projectDir: dir, agent: 'test' },
      { name: 'B', kind: '3d' },
    );
    expect(second.ok).toBe(false);
    expect(second.validationErrors.join(' ')).toMatch(/Já existe/);
    await rm(dir, { recursive: true, force: true });
  });
});

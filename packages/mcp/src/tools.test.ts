import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { callOpTool, listOpTools } from './tools.js';
import { findTool, TOOL_CATALOG } from './schemas.js';

describe('tool catalog', () => {
  it('expõe 21 tools (1 por op)', () => {
    expect(TOOL_CATALOG).toHaveLength(21);
  });

  it('cada tool tem name, description, inputSchema com type=object', () => {
    for (const tool of TOOL_CATALOG) {
      expect(tool.name).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(typeof tool.description).toBe('string');
      expect((tool.inputSchema as { type: string }).type).toBe('object');
    }
  });

  it('cada tool inclui projectDir como required', () => {
    for (const tool of TOOL_CATALOG) {
      const required = (tool.inputSchema as { required: string[] }).required;
      expect(required).toContain('projectDir');
    }
  });

  it('findTool recupera por nome', () => {
    expect(findTool('object.add')?.name).toBe('object.add');
    expect(findTool('object.unknown')).toBeUndefined();
  });

  it('listOpTools retorna o mesmo conjunto de nomes', () => {
    const fromList = listOpTools().map((t) => t.name).sort();
    const fromCatalog = TOOL_CATALOG.map((t) => t.name).sort();
    expect(fromList).toEqual(fromCatalog);
  });
});

describe('callOpTool', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pixl-mcp-'));
    await rm(dir, { recursive: true, force: true });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('dispatcha project.create e retorna isError=false', async () => {
    const result = await callOpTool('project.create', {
      projectDir: dir, name: 'MCP Test', kind: '3d', id: 'mcp_test',
    });
    expect(result.isError).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).ok).toBe(true);
  });

  it('chama object.add end-to-end via MCP', async () => {
    await callOpTool('project.create', {
      projectDir: dir, name: 'T', kind: '3d', id: 'p1',
    });
    const result = await callOpTool('object.add', {
      projectDir: dir, sceneId: 'main', parentId: null, type: 'cube', id: 'obj_x',
    });
    expect(result.isError).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).changedFiles).toContain('project.pixlproject.json');
  });

  it('retorna isError=true com tool desconhecida', async () => {
    const result = await callOpTool('object.fly', { projectDir: dir });
    expect(result.isError).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).validationErrors.join(' ')).toMatch(/desconhecida/);
  });

  it('retorna isError=true sem projectDir', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await callOpTool('project.validate', {} as any);
    expect(result.isError).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).validationErrors.join(' ')).toMatch(/projectDir/);
  });

  it('propaga validationErrors estruturados de uma op (refusal)', async () => {
    await callOpTool('project.create', {
      projectDir: dir, name: 'A', kind: '3d', id: 'a',
    });
    // Try to create again → ok:false with structured error.
    const result = await callOpTool('project.create', {
      projectDir: dir, name: 'B', kind: '3d', id: 'b',
    });
    expect(result.isError).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).validationErrors.length).toBeGreaterThan(0);
  });

  it('agent é "mcp" no OpContext', async () => {
    // We can't directly observe OpContext from here, but the creation must succeed.
    // Subscribing to the broadcast inside engine-ops would reveal byAgent='mcp'.
    // For now: smoke that the call succeeds and produces a hash.
    const result = await callOpTool('project.create', {
      projectDir: dir, name: 'A', kind: '3d', id: 'p1',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('script.read retorna formato customizado (não OpResult)', async () => {
    await callOpTool('project.create', {
      projectDir: dir, name: 'T', kind: '3d', id: 'p1',
    });
    await callOpTool('script.write', {
      projectDir: dir, path: 'sample.js', source: 'console.log(1)\n',
    });
    const result = await callOpTool('script.read', { projectDir: dir, path: 'sample.js' });
    expect(result.isError).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.result as any).source).toContain('console.log');
  });
});

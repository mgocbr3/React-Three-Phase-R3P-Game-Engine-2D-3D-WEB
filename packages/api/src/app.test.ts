// HTTP route tests via Hono's Fetch-API runner. No port binding — pure.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { KNOWN_OPS } from './dispatch.js';

const callApp = async (
  request: Request,
): Promise<{ status: number; body: unknown }> => {
  const app = buildApp();
  const response = await app.fetch(request);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON, keep text
  }
  return { status: response.status, body };
};

describe('GET /healthz', () => {
  it('responde 200 ok', async () => {
    const { status, body } = await callApp(new Request('http://x/healthz'));
    expect(status).toBe(200);
    expect(body).toBe('ok');
  });
});

describe('GET /tools', () => {
  it('lista os 21 ops', async () => {
    const { status, body } = await callApp(new Request('http://x/tools'));
    expect(status).toBe(200);
    expect((body as { ops: string[] }).ops).toHaveLength(21);
    expect((body as { ops: string[] }).ops).toEqual([...KNOWN_OPS]);
  });
});

describe('GET /project', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pixl-api-get-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('exige projectDir', async () => {
    const { status } = await callApp(new Request('http://x/project'));
    expect(status).toBe(400);
  });

  it('retorna 404 quando o doc não existe', async () => {
    const url = `http://x/project?projectDir=${encodeURIComponent(dir)}`;
    const { status } = await callApp(new Request(url));
    expect(status).toBe(404);
  });

  it('retorna o doc quando ele existe', async () => {
    const docPath = path.join(dir, 'project.pixlproject.json');
    await writeFile(docPath, JSON.stringify({ format: 'pixlplayground-project', version: 2, id: 'p', name: 'P', activeSceneId: 'main', scenes: [{ id: 'main', name: 'Main', kind: '3d', rootObjects: [] }] }), 'utf8');
    const url = `http://x/project?projectDir=${encodeURIComponent(dir)}`;
    const { status, body } = await callApp(new Request(url));
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
  });
});

describe('POST /ops/:name', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pixl-api-post-'));
    await rm(dir, { recursive: true, force: true });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('dispatcha project.create e retorna 200', async () => {
    const req = new Request('http://x/ops/project.create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectDir: dir, name: 'A', kind: '3d', id: 'p1' }),
    });
    const { status, body } = await callApp(req);
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
  });

  it('end-to-end: create + object.add via HTTP', async () => {
    await callApp(new Request('http://x/ops/project.create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectDir: dir, name: 'A', kind: '3d', id: 'p1' }),
    }));
    const { status, body } = await callApp(new Request('http://x/ops/object.add', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectDir: dir, sceneId: 'main', parentId: null, type: 'cube', id: 'o1' }),
    }));
    expect(status).toBe(200);
    expect((body as { ok: boolean }).ok).toBe(true);
  });

  it('retorna 404 com op desconhecida', async () => {
    const { status, body } = await callApp(new Request('http://x/ops/object.fly', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectDir: dir }),
    }));
    expect(status).toBe(404);
    expect((body as { validationErrors: string[] }).validationErrors[0]).toMatch(/desconhecida/);
  });

  it('retorna 400 sem projectDir', async () => {
    const { status } = await callApp(new Request('http://x/ops/project.validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect(status).toBe(400);
  });

  it('retorna 400 com body inválido (não JSON)', async () => {
    const { status } = await callApp(new Request('http://x/ops/project.validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: 'not json',
    }));
    expect(status).toBe(400);
  });

  it('propaga ok=false (refusal) como 400', async () => {
    await callApp(new Request('http://x/ops/project.create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectDir: dir, name: 'A', kind: '3d', id: 'p1' }),
    }));
    const { status, body } = await callApp(new Request('http://x/ops/project.create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectDir: dir, name: 'B', kind: '3d', id: 'p2' }),
    }));
    expect(status).toBe(400);
    expect((body as { ok: boolean }).ok).toBe(false);
  });
});

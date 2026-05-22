// Hono app builder. Pure — does not bind to a port. Tests fetch against
// `app.fetch(request)` directly (Web Fetch API).

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { Hono } from 'hono';

import { KNOWN_OPS, dispatchHttp } from './dispatch.js';

export const buildApp = (): Hono => {
  const app = new Hono();

  app.get('/healthz', (c) => c.text('ok'));

  app.get('/tools', (c) => c.json({ ops: KNOWN_OPS }));

  app.get('/project', async (c) => {
    const projectDir = c.req.query('projectDir');
    if (!projectDir) {
      return c.json({ ok: false, validationErrors: ['projectDir query é obrigatório.'] }, 400);
    }
    try {
      const docPath = path.join(projectDir, 'project.pixlproject.json');
      const raw = await fs.readFile(docPath, 'utf8');
      const doc = JSON.parse(raw);
      return c.json({ ok: true, projectDir, doc });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ ok: false, validationErrors: [message] }, 404);
    }
  });

  app.post('/ops/:name', async (c) => {
    const name = c.req.param('name');
    let body: Record<string, unknown> = {};
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json(
        { ok: false, validationErrors: ['Body deve ser JSON object.'] },
        400,
      );
    }
    const { status, body: out } = await dispatchHttp(name, body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json(out as any, status as 200 | 400 | 404);
  });

  return app;
};

#!/usr/bin/env node
// Boot script. Hono REST + WebSocket on the same port (default 8765).
// Override with $PORT or $PIXL_API_PORT.

import type { Server as HttpServer } from 'node:http';

import { serve } from '@hono/node-server';

import { buildApp } from './app.js';
import { attachWebSocketBridge } from './ws.js';

const DEFAULT_PORT = 8765;

const resolvePort = (): number => {
  const fromEnv = process.env.PIXL_API_PORT ?? process.env.PORT;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_PORT;
};

const port = resolvePort();
const app = buildApp();

const server = serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[pixl-api] listening on http://localhost:${info.port} (ws: ws://localhost:${info.port}/ws)`);
});

attachWebSocketBridge(server as unknown as HttpServer, { path: '/ws' });

const shutdown = (): void => {
  // eslint-disable-next-line no-console
  console.log('[pixl-api] shutting down…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

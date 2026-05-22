// WebSocket bridge integration test. Boots a real Node HTTP server on an
// ephemeral port, attaches the bridge, opens a ws client, emits a
// ProjectEvent via engine-ops' broadcast, asserts the client received it.

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import {
  broadcastProjectEvent,
  unsubscribeAllProjectEvents,
} from '@pixlland/engine-ops';

import { attachWebSocketBridge, type WsHandle } from './ws.js';

let server: ReturnType<typeof createServer> | undefined;
let bridge: WsHandle | undefined;
let port = 0;

const startServer = async (): Promise<number> => {
  const s = createServer((_req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  bridge = attachWebSocketBridge(s, { path: '/ws' });
  server = s;
  return (s.address() as AddressInfo).port;
};

const stopServer = async (): Promise<void> => {
  bridge?.stop();
  bridge = undefined;
  await new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
  server = undefined;
};

// Buffered client wrapper so we don't race against early server frames.
interface BufferedClient {
  ws: WebSocket;
  /** Messages received so far. */
  buffer: string[];
  /** Append-only listener; tests use it via waitFrame. */
  onAny: (listener: (text: string) => void) => () => void;
}

const openClient = (port: number): Promise<BufferedClient> => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const buffer: string[] = [];
  const listeners = new Set<(text: string) => void>();
  ws.on('message', (data: WebSocket.RawData) => {
    const text = data.toString();
    buffer.push(text);
    for (const listener of [...listeners]) listener(text);
  });
  return new Promise((resolve, reject) => {
    ws.once('open', () => {
      resolve({
        ws,
        buffer,
        onAny: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
    });
    ws.once('error', (err) => reject(err));
  });
};

const waitFrame = async (
  client: BufferedClient,
  predicate: (data: string) => boolean,
  timeoutMs = 3000,
): Promise<string> => {
  // First scan the buffer in case the frame already arrived.
  for (const existing of client.buffer) {
    if (predicate(existing)) return existing;
  }
  return new Promise((resolve, reject) => {
    const off = client.onAny((text) => {
      if (predicate(text)) {
        off();
        clearTimeout(timer);
        resolve(text);
      }
    });
    const timer = setTimeout(() => {
      off();
      reject(new Error('timeout waiting for frame'));
    }, timeoutMs);
  });
};

describe('attachWebSocketBridge', () => {
  beforeEach(async () => {
    unsubscribeAllProjectEvents();
    port = await startServer();
  });
  afterEach(async () => {
    await stopServer();
  });

  it('envia hello frame ao conectar', async () => {
    const c = await openClient(port);
    const text = await waitFrame(c, (data) => data.includes('hello'));
    expect(text).toContain('hello');
    c.ws.close();
  });

  it('encaminha ProjectEvent emitido por engine-ops', async () => {
    const c = await openClient(port);
    await waitFrame(c, (data) => data.includes('hello')); // drain hello
    setTimeout(() => {
      broadcastProjectEvent({
        type: 'object.added',
        sceneId: 'main',
        objectId: 'obj_ws',
        contentHash: 'abc',
        byAgent: 'http',
      });
    }, 30);
    const text = await waitFrame(c, (data) => data.includes('object.added'));
    const event = JSON.parse(text);
    expect(event.objectId).toBe('obj_ws');
    expect(event.byAgent).toBe('http');
    c.ws.close();
  });

  it('múltiplos clientes recebem o mesmo evento', async () => {
    const a = await openClient(port);
    const b = await openClient(port);
    await Promise.all([
      waitFrame(a, (data) => data.includes('hello')),
      waitFrame(b, (data) => data.includes('hello')),
    ]);
    setTimeout(() => {
      broadcastProjectEvent({
        type: 'scene.activated',
        sceneId: 's1',
        contentHash: 'h',
        byAgent: 'cli',
      });
    }, 30);
    const [aText, bText] = await Promise.all([
      waitFrame(a, (data) => data.includes('scene.activated')),
      waitFrame(b, (data) => data.includes('scene.activated')),
    ]);
    expect(JSON.parse(aText).sceneId).toBe('s1');
    expect(JSON.parse(bText).sceneId).toBe('s1');
    a.ws.close();
    b.ws.close();
  });

  it('cliente desconectado não recebe mais eventos', async () => {
    const a = await openClient(port);
    await waitFrame(a, (data) => data.includes('hello'));
    a.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    // No throw means no broadcasts to closed sockets caused errors.
    expect(() =>
      broadcastProjectEvent({
        type: 'object.added',
        sceneId: 'main',
        objectId: 'obj_z',
        contentHash: 'h',
        byAgent: 'cli',
      }),
    ).not.toThrow();
  });

  it('stop() desativa o bridge (não há vazamento de subscribers)', async () => {
    bridge?.stop();
    bridge = undefined;
    // After stop, broadcasting should not crash even though no sockets exist.
    expect(() =>
      broadcastProjectEvent({
        type: 'project.closed',
        projectDir: '/x',
        byAgent: 'cli',
      }),
    ).not.toThrow();
  });
});

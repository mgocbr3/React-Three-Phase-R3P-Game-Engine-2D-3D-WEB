// WebSocket bridge: every engine-ops ProjectEvent → JSON frame to all
// connected clients. Attaches to a Node http.Server passed in by the boot.

import type { Server as HttpServer } from 'node:http';

import {
  subscribeProjectEvents,
  type ProjectEvent,
} from '@pixlland/engine-ops';
import { WebSocketServer, type WebSocket } from 'ws';

export interface WsHandle {
  wss: WebSocketServer;
  /** Detach the engine-ops subscription and close all client sockets. */
  stop: () => void;
}

export const attachWebSocketBridge = (
  httpServer: HttpServer,
  options: { path?: string } = {},
): WsHandle => {
  const wss = new WebSocketServer({ server: httpServer, path: options.path ?? '/ws' });
  const sockets = new Set<WebSocket>();

  wss.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    // Optional: send a hello frame so clients can confirm the connection.
    try {
      socket.send(JSON.stringify({ type: 'hello', server: '@pixlland/engine-api' }));
    } catch {
      // ignore — socket may have closed mid-handshake
    }
  });

  const unsubscribe = subscribeProjectEvents((event: ProjectEvent) => {
    const frame = JSON.stringify(event);
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) {
        try {
          socket.send(frame);
        } catch {
          // best-effort; drop frames on errored sockets
        }
      }
    }
  });

  return {
    wss,
    stop: () => {
      unsubscribe();
      for (const socket of sockets) {
        try {
          socket.close();
        } catch {
          // best-effort
        }
      }
      sockets.clear();
      wss.close();
    },
  };
};

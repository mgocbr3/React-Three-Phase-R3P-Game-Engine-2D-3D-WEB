// Subscribes the studio to @pixlland/engine-api's WS broadcaster (port 8765
// by default). When a non-editor agent (cli/mcp/http) mutates the project
// document, the WS frame triggers `onEvent`. Studio then re-loads the doc
// from disk via engine-ops to refresh the local model.
//
// Per GDD §6.4 — Phase 6A wires this up; full studio→ops bridge for outgoing
// writes is Phase 6B.

import { useEffect, useRef } from 'react';

import type { ProjectEvent } from '@pixlland/engine-ops';

const DEFAULT_URL = 'ws://localhost:8765/ws';

export interface UseEngineApiBridgeOptions {
  url?: string;
  /** Called for every ProjectEvent received. The studio decides what to refetch. */
  onEvent?: (event: ProjectEvent) => void;
  /** Disable the bridge entirely (e.g. when the API server is not running locally). */
  disabled?: boolean;
}

export const useEngineApiBridge = (options: UseEngineApiBridgeOptions = {}): void => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (options.disabled) return;
    const url = options.url ?? DEFAULT_URL;

    let ws: WebSocket | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      try {
        ws = new WebSocket(url);
      } catch {
        // Browser refused immediate construction — schedule retry.
        scheduleReconnect();
        return;
      }
      ws.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data) as ProjectEvent | { type: 'hello' };
          if (data && typeof data === 'object' && 'type' in data && data.type !== 'hello') {
            optionsRef.current.onEvent?.(data as ProjectEvent);
          }
        } catch {
          // ignore malformed frames
        }
      });
      ws.addEventListener('close', () => {
        ws = null;
        if (!stopped) scheduleReconnect();
      });
      ws.addEventListener('error', () => {
        // Connection refused or net::ERR_* — let close handler retry.
      });
    };

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 3000);
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [options.disabled, options.url]);
};

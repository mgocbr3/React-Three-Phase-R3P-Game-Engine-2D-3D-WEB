// Tiny ProjectEvent emitter. In Phase 4 the HTTP+WS server attaches a listener
// that forwards every event to connected WebSocket clients. In tests, listeners
// can be attached to assert that the expected event was emitted.

import type { ProjectEvent, ProjectEventListener } from './types.js';

const listeners = new Set<ProjectEventListener>();

export const subscribeProjectEvents = (listener: ProjectEventListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const unsubscribeAllProjectEvents = (): void => {
  listeners.clear();
};

export const broadcastProjectEvent = (event: ProjectEvent): void => {
  // Snapshot before iterating so a listener that unsubscribes itself doesn't
  // mutate the set under us.
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      // Listener exceptions must NEVER fail the op that emitted the event.
      // Log to stderr in dev; in production this should be a proper logger.
      // eslint-disable-next-line no-console
      console.error('[engine-ops] broadcastProjectEvent listener threw:', error);
    }
  }
};

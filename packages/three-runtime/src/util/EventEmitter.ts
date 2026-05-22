// Adapted from tools/vendor/three-game-engine/src/util/EventEmitter.ts
// (MIT, WesUnwin/three-game-engine). Tightened typing for our TS-strict
// build and fixed a latent bug in removeEventListener.

export type EventCallback<T = unknown> = (args: T) => void;

interface EventListenerMap {
  [eventName: string]: EventCallback[];
}

/**
 * To reduce dependencies on third-party sources, this is a simplistic event
 * emitter class that can emit and listen for events.
 */
class EventEmitter {
  eventListeners: EventListenerMap;
  oneTimeListeners: EventListenerMap;

  constructor() {
    this.eventListeners = {};
    this.oneTimeListeners = {};
  }

  emit(eventName: string, args?: unknown): void {
    const callbackFns = (this.eventListeners[eventName] ?? []).concat(
      this.oneTimeListeners[eventName] ?? [],
    );
    this.oneTimeListeners[eventName] = [];
    callbackFns.forEach((fn) => fn(args));
  }

  addEventListener(eventName: string, fn: EventCallback): void {
    const existingListeners = this.eventListeners[eventName] ?? [];
    this.eventListeners[eventName] = existingListeners.concat(fn);
  }

  once(eventName: string, fn: EventCallback): void {
    const existingListeners = this.oneTimeListeners[eventName] ?? [];
    this.oneTimeListeners[eventName] = existingListeners.concat(fn);
  }

  removeEventListener(eventName: string, fn: EventCallback): void {
    const listeners = this.eventListeners[eventName] ?? [];
    this.eventListeners[eventName] = listeners.filter((listener) => listener !== fn);
  }
}

export default EventEmitter;

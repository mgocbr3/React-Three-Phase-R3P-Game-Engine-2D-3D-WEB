type EventCallback = (data: any) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(eventName: string, callback: EventCallback): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventName)?.delete(callback);
    };
  }

  emit(eventName: string, data?: any): void {
    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          console.error(`Error in event handler for "${eventName}":`, error);
        }
      });
    }
  }

  once(eventName: string, callback: EventCallback): () => void {
    const wrapper: EventCallback = (data) => {
      callback(data);
      this.listeners.get(eventName)?.delete(wrapper);
    };
    return this.on(eventName, wrapper);
  }

  off(eventName: string, callback?: EventCallback): void {
    if (callback) {
      this.listeners.get(eventName)?.delete(callback);
    } else {
      this.listeners.delete(eventName);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();

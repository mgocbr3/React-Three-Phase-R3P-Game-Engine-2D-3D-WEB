// Adapted from tools/vendor/three-game-engine/src/Component.ts
// (MIT, WesUnwin/three-game-engine).

import type GameObject from './GameObject.js';

export interface ComponentJSON {
  name?: string;
  type: string;
  [key: string]: unknown;
}

export interface ComponentTickContext {
  deltaTimeInSec: number;
}

/**
 * Abstract base class for game object components.
 */
class Component {
  gameObject: GameObject;
  jsonData: ComponentJSON;

  constructor(gameObject: GameObject, jsonData: ComponentJSON) {
    this.gameObject = gameObject;
    this.jsonData = jsonData;
  }

  getName(): string | undefined {
    return this.jsonData.name;
  }

  getType(): string {
    return this.jsonData.type;
  }

  // Overridable lifecycle hooks.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  load(): void | Promise<void> {
    // Override in subclass.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  beforeRender(ctx: ComponentTickContext): void {
    // Override in subclass.
  }

  unload(): void {
    // Override in subclass.
  }
}

export default Component;

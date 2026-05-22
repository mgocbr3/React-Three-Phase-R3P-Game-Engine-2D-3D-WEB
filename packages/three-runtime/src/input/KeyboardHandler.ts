// Adapted from tools/vendor/three-game-engine/src/input/KeyboardHandler.ts
// (MIT, WesUnwin/three-game-engine).

class KeyboardHandler {
  private pressedKeys: Map<string, boolean>;
  private shiftIsDown: boolean;

  constructor() {
    this.pressedKeys = new Map();
    this.shiftIsDown = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
    }
  }

  private _onKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.set(event.key.toLowerCase(), true);
    this.shiftIsDown = event.shiftKey;
  };

  private _onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.set(event.key.toLowerCase(), false);
    this.shiftIsDown = event.shiftKey;
  };

  isKeyDown(key: string): boolean {
    return this.pressedKeys.get(key.toLowerCase()) ?? false;
  }

  isShiftDown(): boolean {
    return this.shiftIsDown;
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }
  }
}

export default KeyboardHandler;

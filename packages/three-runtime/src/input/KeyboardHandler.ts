// Adapted from tools/vendor/three-game-engine/src/input/KeyboardHandler.ts
// (MIT, WesUnwin/three-game-engine).

const KEYBOARD_EVENT_OPTIONS: AddEventListenerOptions = { capture: true };

const normalizeKey = (value: string | undefined): string | null => {
  const key = value?.trim().toLowerCase();
  return key ? key : null;
};

const getKeyboardKeys = (event: KeyboardEvent): string[] => {
  const keys = [normalizeKey(event.key), normalizeKey(event.code)].filter((key): key is string => key !== null);
  return Array.from(new Set(keys));
};

class KeyboardHandler {
  private pressedKeys: Map<string, boolean>;
  private shiftIsDown: boolean;

  constructor() {
    this.pressedKeys = new Map();
    this.shiftIsDown = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown, KEYBOARD_EVENT_OPTIONS);
      window.addEventListener('keyup', this._onKeyUp, KEYBOARD_EVENT_OPTIONS);
      window.addEventListener('blur', this._clearPressedState);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  private _onKeyDown = (event: KeyboardEvent): void => {
    getKeyboardKeys(event).forEach((key) => this.pressedKeys.set(key, true));
    this.shiftIsDown = event.shiftKey;
  };

  private _onKeyUp = (event: KeyboardEvent): void => {
    getKeyboardKeys(event).forEach((key) => this.pressedKeys.set(key, false));
    this.shiftIsDown = event.shiftKey;
  };

  private _clearPressedState = (): void => {
    this.pressedKeys.clear();
    this.shiftIsDown = false;
  };

  private _onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') this._clearPressedState();
  };

  isKeyDown(key: string): boolean {
    return this.pressedKeys.get(key.toLowerCase()) ?? false;
  }

  isShiftDown(): boolean {
    return this.shiftIsDown;
  }

  clear(): void {
    this._clearPressedState();
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown, KEYBOARD_EVENT_OPTIONS);
      window.removeEventListener('keyup', this._onKeyUp, KEYBOARD_EVENT_OPTIONS);
      window.removeEventListener('blur', this._clearPressedState);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    this.clear();
  }
}

export default KeyboardHandler;

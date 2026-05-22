// Adapted from tools/vendor/three-game-engine/src/input/InputManager.ts
// (MIT, WesUnwin/three-game-engine).

import GamepadHandler from './GamepadHandler.js';
import KeyboardHandler from './KeyboardHandler.js';
import MouseHandler from './MouseHandler.js';
import type { InputOptions } from '../types.js';

const DEFAULT_OPTIONS: Required<Pick<InputOptions, 'wsadMovement'>> = {
  wsadMovement: true,
};

class InputManager {
  options: InputOptions;
  keyboardHandler: KeyboardHandler;
  mouseHandler: MouseHandler;
  gamepadHandler: GamepadHandler;

  constructor(canvas: HTMLCanvasElement, options: InputOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.keyboardHandler = new KeyboardHandler();
    this.mouseHandler = new MouseHandler(canvas, options.mouseOptions);
    this.gamepadHandler = new GamepadHandler();
  }

  beforeRender(): void {
    this.gamepadHandler.readGamepads();
  }

  /** Returns -1.0 .. 1.0 from any of keyboard / gamepad. */
  readVerticalAxis(): number {
    if (this.options.wsadMovement
      && (this.keyboardHandler.isKeyDown('w') || this.keyboardHandler.isKeyDown('ArrowUp'))) {
      return -1.0;
    }
    if (this.keyboardHandler.isKeyDown('s') || this.keyboardHandler.isKeyDown('ArrowDown')) {
      return 1.0;
    }
    if (this.gamepadHandler.anyGamepadConnected()) {
      return this.gamepadHandler.readVerticalAxis();
    }
    return 0;
  }

  readHorizontalAxis(): number {
    if (this.options.wsadMovement
      && (this.keyboardHandler.isKeyDown('a') || this.keyboardHandler.isKeyDown('ArrowLeft'))) {
      return -1.0;
    }
    if (this.keyboardHandler.isKeyDown('d') || this.keyboardHandler.isKeyDown('ArrowRight')) {
      return 1.0;
    }
    if (this.gamepadHandler.anyGamepadConnected()) {
      return this.gamepadHandler.readHorizontalAxis();
    }
    return 0;
  }

  dispose(): void {
    this.keyboardHandler.dispose();
    this.gamepadHandler.teardown();
  }
}

export default InputManager;

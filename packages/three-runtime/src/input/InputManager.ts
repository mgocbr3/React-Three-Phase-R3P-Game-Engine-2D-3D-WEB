// Adapted from tools/vendor/three-game-engine/src/input/InputManager.ts
// (MIT, WesUnwin/three-game-engine).

import GamepadHandler from './GamepadHandler.js';
import KeyboardHandler from './KeyboardHandler.js';
import MouseHandler from './MouseHandler.js';
import type { InputOptions } from '../types.js';

const DEFAULT_OPTIONS: Required<Pick<InputOptions, 'wsadMovement'>> = {
  wsadMovement: true,
};

export const normalizeInputAxis = (value: number, deadzone = 0.18): number => {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value));
  const zone = Math.max(0, Math.min(0.95, deadzone));
  const magnitude = Math.abs(clamped);
  if (magnitude <= zone) return 0;
  return Math.sign(clamped) * ((magnitude - zone) / (1 - zone));
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
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', this._onPointerLockChange);
    }
  }

  private _onPointerLockChange = (): void => {
    if (!this.mouseHandler.isPointerLocked()) this.keyboardHandler.clear();
  };

  beforeRender(): void {
    this.gamepadHandler.readGamepads();
  }

  /** Returns -1.0 .. 1.0 from any of keyboard / gamepad. */
  readVerticalAxis(): number {
    let keyboardAxis = 0;
    if (this.options.wsadMovement
      && (this.keyboardHandler.isKeyDown('w')
        || this.keyboardHandler.isKeyDown('keyw')
        || this.keyboardHandler.isKeyDown('ArrowUp'))) {
      keyboardAxis -= 1;
    }
    if (this.keyboardHandler.isKeyDown('s')
      || this.keyboardHandler.isKeyDown('keys')
      || this.keyboardHandler.isKeyDown('ArrowDown')) {
      keyboardAxis += 1;
    }
    if (keyboardAxis !== 0) return Math.max(-1, Math.min(1, keyboardAxis));
    if (this.gamepadHandler.anyGamepadConnected()) {
      return normalizeInputAxis(this.gamepadHandler.readVerticalAxis(), this.options.gamepadDeadzone);
    }
    return 0;
  }

  readHorizontalAxis(): number {
    let keyboardAxis = 0;
    if (this.options.wsadMovement
      && (this.keyboardHandler.isKeyDown('a')
        || this.keyboardHandler.isKeyDown('keya')
        || this.keyboardHandler.isKeyDown('ArrowLeft'))) {
      keyboardAxis -= 1;
    }
    if (this.keyboardHandler.isKeyDown('d')
      || this.keyboardHandler.isKeyDown('keyd')
      || this.keyboardHandler.isKeyDown('ArrowRight')) {
      keyboardAxis += 1;
    }
    if (keyboardAxis !== 0) return Math.max(-1, Math.min(1, keyboardAxis));
    if (this.gamepadHandler.anyGamepadConnected()) {
      return normalizeInputAxis(this.gamepadHandler.readHorizontalAxis(), this.options.gamepadDeadzone);
    }
    return 0;
  }

  readLookHorizontalAxis(): number {
    if (!this.gamepadHandler.anyGamepadConnected()) return 0;
    return normalizeInputAxis(this.gamepadHandler.readAxisValue(2), this.options.gamepadDeadzone);
  }

  readLookVerticalAxis(): number {
    if (!this.gamepadHandler.anyGamepadConnected()) return 0;
    return normalizeInputAxis(this.gamepadHandler.readAxisValue(3), this.options.gamepadDeadzone);
  }

  isJumpPressed(): boolean {
    return this.keyboardHandler.isKeyDown(' ')
      || this.keyboardHandler.isKeyDown('space')
      || this.keyboardHandler.isKeyDown('spacebar')
      || this.gamepadHandler.isButtonPressed('A');
  }

  isSprintPressed(): boolean {
    return this.keyboardHandler.isShiftDown()
      || this.gamepadHandler.isButtonPressed('LeftStick')
      || this.gamepadHandler.readButtonValue('LowerRightTrigger') > 0.5;
  }

  isCrouchPressed(): boolean {
    return this.keyboardHandler.isKeyDown('control')
      || this.keyboardHandler.isKeyDown('controlleft')
      || this.keyboardHandler.isKeyDown('controlright')
      || this.keyboardHandler.isKeyDown('c')
      || this.keyboardHandler.isKeyDown('keyc')
      || this.gamepadHandler.isButtonPressed('B')
      || this.gamepadHandler.isButtonPressed('RightStick');
  }

  setPointerLockEnabled(enabled: boolean): void {
    this.mouseHandler.setPointerLockEnabled(enabled);
    if (!enabled) this.keyboardHandler.clear();
  }

  dispose(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    }
    this.keyboardHandler.dispose();
    this.mouseHandler.dispose();
    this.gamepadHandler.teardown();
  }
}

export default InputManager;

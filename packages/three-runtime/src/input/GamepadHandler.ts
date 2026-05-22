// Adapted from tools/vendor/three-game-engine/src/input/GamepadHandler.ts
// (MIT, WesUnwin/three-game-engine). Fixed a latent bug in `getButton` —
// the original returned from the forEach callback (no-op).

export const BUTTON_NAMES = [
  'A', 'B', 'X', 'Y',
  'UpperLeftTrigger', 'UpperRightTrigger',
  'LowerLeftTrigger', 'LowerRightTrigger',
  'Back', 'Start',
  'LeftStick', 'RightStick',
  'Up', 'Down', 'Left', 'Right',
] as const;

class GamepadHandler {
  gamepads: (Gamepad | null)[];
  apiSupported: boolean;

  constructor() {
    this.gamepads = [];
    this.apiSupported = this.isGamepadAPISupported();
    if (this.apiSupported) {
      this.setup();
    }
  }

  isGamepadAPISupported(): boolean {
    return typeof navigator !== 'undefined' && 'getGamepads' in navigator;
  }

  setup(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', this._onGamePadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamePadDisconnected);
  }

  teardown(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('gamepadconnected', this._onGamePadConnected);
    window.removeEventListener('gamepaddisconnected', this._onGamePadDisconnected);
  }

  anyGamepadConnected(): boolean {
    return this.gamepads.some(Boolean);
  }

  private _onGamePadConnected = (): void => {
    this.readGamepads();
  };

  private _onGamePadDisconnected = (): void => {
    this.readGamepads();
  };

  /** Must be called every frame to refresh button/axis state. */
  readGamepads(): void {
    if (!this.apiSupported) return;
    const list = navigator.getGamepads();
    this.gamepads = Array.from(list);
  }

  getButtonIndex(button: number | string): number {
    if (typeof button === 'number') {
      if (button < 0 || button > 15) {
        throw new Error(`GamepadHandler.getButtonIndex: number must be 0–15, got ${button}`);
      }
      return button;
    }
    const idx = (BUTTON_NAMES as readonly string[]).indexOf(button);
    if (idx === -1) {
      throw new Error(`GamepadHandler.getButtonIndex: unknown button ${button}`);
    }
    return idx;
  }

  getButton(button: number | string): GamepadButton | null {
    const idx = this.getButtonIndex(button);
    for (const gamepad of this.gamepads) {
      if (!gamepad) continue;
      const b = gamepad.buttons[idx];
      if (b) return b;
    }
    return null;
  }

  isButtonPressed(button: number | string): boolean {
    return this.getButton(button)?.pressed ?? false;
  }

  readButtonValue(button: number | string): number {
    return this.getButton(button)?.value ?? 0;
  }

  readAxisValue(axisIndex: number): number {
    for (const gamepad of this.gamepads) {
      if (gamepad && typeof gamepad.axes[axisIndex] === 'number') {
        return gamepad.axes[axisIndex];
      }
    }
    return 0;
  }

  readVerticalAxis(): number {
    const amounts: number[] = [];
    for (const gamepad of this.gamepads) {
      if (!gamepad) continue;
      const up = gamepad.buttons[12];
      if (up) amounts.push(up.value * -1.0);
      const down = gamepad.buttons[13];
      if (down) amounts.push(down.value);
      const axis = gamepad.axes[1];
      if (typeof axis === 'number') amounts.push(axis);
    }
    return amounts
      .filter((a) => Math.abs(a) > 0.01)
      .reduce((sum, a) => sum + a, 0);
  }

  readHorizontalAxis(): number {
    const amounts: number[] = [];
    for (const gamepad of this.gamepads) {
      if (!gamepad) continue;
      const left = gamepad.buttons[14];
      if (left) amounts.push(left.value * -1.0);
      const right = gamepad.buttons[15];
      if (right) amounts.push(right.value);
      const axis = gamepad.axes[0];
      if (typeof axis === 'number') amounts.push(axis);
    }
    return amounts
      .filter((a) => Math.abs(a) > 0.01)
      .reduce((sum, a) => sum + a, 0);
  }
}

export default GamepadHandler;

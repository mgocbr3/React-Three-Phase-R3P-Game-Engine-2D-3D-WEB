// Adapted from tools/vendor/three-game-engine/src/input/MouseHandler.ts
// (MIT, WesUnwin/three-game-engine).

import type { MouseOptions } from '../types.js';

class MouseHandler {
  canvas: HTMLCanvasElement;
  options: MouseOptions;
  private pointerX: number;
  private pointerY: number;
  private pointerLockEnabled: boolean;

  constructor(canvas: HTMLCanvasElement, options: MouseOptions = {}) {
    this.canvas = canvas;
    this.pointerX = 0;
    this.pointerY = 0;
    this.options = options;
    this.pointerLockEnabled = options.usePointerLock ?? false;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.canvas.addEventListener('click', this._onCanvasClick);
    if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  private _onCanvasClick = (): void => {
    if (!this.pointerLockEnabled) return;
    if (typeof document !== 'undefined' && document.pointerLockElement === this.canvas) return;
    try {
      const request = this.canvas.requestPointerLock?.() as Promise<void> | void;
      request?.catch?.(() => undefined);
    } catch {
      // Embedded browsers and sandboxed frames can deny pointer lock.
    }
  };

  private _onMouseMove = (event: MouseEvent): void => {
    this.pointerX += event.movementX;
    this.pointerY += event.movementY;
  };

  private _onPointerLockChange = (): void => {
    if (document.pointerLockElement === this.canvas) {
      document.addEventListener('mousemove', this._onMouseMove, false);
    } else {
      document.removeEventListener('mousemove', this._onMouseMove, false);
    }
  };

  setPointerLockEnabled(enabled: boolean): void {
    this.pointerLockEnabled = enabled;
    if (typeof document !== 'undefined' && !enabled && document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
  }

  isPointerLocked(): boolean {
    return typeof document !== 'undefined' && document.pointerLockElement === this.canvas;
  }

  getPointerX(): number {
    return this.pointerX;
  }

  getPointerY(): number {
    return this.pointerY;
  }

  dispose(): void {
    this.canvas.removeEventListener('click', this._onCanvasClick);
    if (typeof document === 'undefined') return;
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove, false);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }
}

export default MouseHandler;

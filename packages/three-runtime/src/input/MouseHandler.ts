// Adapted from tools/vendor/three-game-engine/src/input/MouseHandler.ts
// (MIT, WesUnwin/three-game-engine).

import type { MouseOptions } from '../types.js';

class MouseHandler {
  canvas: HTMLCanvasElement;
  options: MouseOptions;
  private pointerX: number;
  private pointerY: number;

  constructor(canvas: HTMLCanvasElement, options: MouseOptions = {}) {
    this.canvas = canvas;
    this.pointerX = 0;
    this.pointerY = 0;
    this.options = options;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (this.options.usePointerLock) {
      this.canvas.addEventListener('click', () => {
        this.canvas.requestPointerLock();
      });
    }

    const onMouseMove = (event: MouseEvent): void => {
      this.pointerX += event.movementX;
      this.pointerY += event.movementY;
    };

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) {
        document.addEventListener('mousemove', onMouseMove, false);
      } else {
        document.removeEventListener('mousemove', onMouseMove, false);
      }
    });
  }

  getPointerX(): number {
    return this.pointerX;
  }

  getPointerY(): number {
    return this.pointerY;
  }
}

export default MouseHandler;

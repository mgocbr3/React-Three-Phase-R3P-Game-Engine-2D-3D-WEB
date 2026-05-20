class InputManager {
  private keysDown: Set<string> = new Set();
  private keysPressed: Set<string> = new Set();
  private keysPrevious: Set<string> = new Set();
  private mouse = { x: 0, y: 0, buttons: 0 };
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('blur', this.handleBlur);
    
    this.initialized = true;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('blur', this.handleBlur);
    
    this.initialized = false;
    this.keysDown.clear();
    this.keysPressed.clear();
    this.keysPrevious.clear();
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    this.mouse.buttons = e.buttons;
  };

  private handleMouseUp = (e: MouseEvent): void => {
    this.mouse.buttons = e.buttons;
  };

  private handleBlur = (): void => {
    this.keysDown.clear();
    this.mouse.buttons = 0;
  };

  // Call this at the start of each frame
  update(): void {
    // Keys that are down this frame but weren't last frame = just pressed
    this.keysPressed.clear();
    this.keysDown.forEach(key => {
      if (!this.keysPrevious.has(key)) {
        this.keysPressed.add(key);
      }
    });
    
    // Store current state for next frame
    this.keysPrevious = new Set(this.keysDown);
  }

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key);
  }

  getKeys(): Set<string> {
    return new Set(this.keysDown);
  }

  getMouse(): { x: number; y: number; buttons: number } {
    return { ...this.mouse };
  }
}

export const inputManager = new InputManager();

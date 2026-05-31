import { afterEach, describe, expect, it } from 'vitest';

import { inputManager } from './input';

const pressKey = (type: 'keydown' | 'keyup', key: string, code: string) => {
  window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));
};

afterEach(() => {
  inputManager.destroy();
});

describe('script inputManager', () => {
  it('accepts both key values and physical key codes for WASD', () => {
    inputManager.init();

    pressKey('keydown', 'w', 'KeyW');

    expect(inputManager.isKeyDown('w')).toBe(true);
    expect(inputManager.isKeyDown('W')).toBe(true);
    expect(inputManager.isKeyDown('KeyW')).toBe(true);

    pressKey('keyup', 'w', 'KeyW');

    expect(inputManager.isKeyDown('w')).toBe(false);
    expect(inputManager.isKeyDown('KeyW')).toBe(false);
  });

  it('keeps physical WASD working on non-US keyboard layouts', () => {
    inputManager.init();

    pressKey('keydown', 'z', 'KeyW');

    expect(inputManager.isKeyDown('z')).toBe(true);
    expect(inputManager.isKeyDown('KeyW')).toBe(true);
    expect(inputManager.isKeyDown('keyw')).toBe(true);
  });
});
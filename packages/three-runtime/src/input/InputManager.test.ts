import { afterEach, describe, expect, it, vi } from 'vitest';

import InputManager, { normalizeInputAxis } from './InputManager.js';

const originalDocument = globalThis.document;

afterEach(() => {
  Object.defineProperty(globalThis, 'document', {
    value: originalDocument,
    configurable: true,
  });
});

describe('normalizeInputAxis', () => {
  it('removes small gamepad drift inside the deadzone', () => {
    expect(normalizeInputAxis(0.03)).toBe(0);
    expect(normalizeInputAxis(-0.17, 0.18)).toBe(0);
  });

  it('rescales usable analog input after the deadzone', () => {
    expect(normalizeInputAxis(1, 0.18)).toBe(1);
    expect(normalizeInputAxis(-1, 0.18)).toBe(-1);
    expect(normalizeInputAxis(0.59, 0.18)).toBeCloseTo(0.5, 5);
  });

  it('clamps invalid or oversized values', () => {
    expect(normalizeInputAxis(Number.NaN)).toBe(0);
    expect(normalizeInputAxis(2)).toBe(1);
    expect(normalizeInputAxis(-2)).toBe(-1);
  });
});

describe('InputManager pointer lock lifecycle', () => {
  it('clears keyboard input when pointer lock is lost', () => {
    const documentTarget = new EventTarget();
    Object.defineProperty(documentTarget, 'pointerLockElement', {
      value: null,
      configurable: true,
    });
    Object.defineProperty(documentTarget, 'exitPointerLock', {
      value: vi.fn(),
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: documentTarget,
      configurable: true,
    });
    const canvas = new EventTarget() as HTMLCanvasElement;
    Object.defineProperty(canvas, 'requestPointerLock', {
      value: vi.fn(),
      configurable: true,
    });
    const manager = new InputManager(canvas, { mouseOptions: { usePointerLock: true } });
    const clear = vi.spyOn(manager.keyboardHandler, 'clear');

    documentTarget.dispatchEvent(new Event('pointerlockchange'));

    expect(clear).toHaveBeenCalled();
    manager.dispose();
  });

  it('reads WASD movement from physical keyboard codes', () => {
    const documentTarget = new EventTarget();
    Object.defineProperty(documentTarget, 'pointerLockElement', {
      value: null,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: documentTarget,
      configurable: true,
    });
    const canvas = new EventTarget() as HTMLCanvasElement;
    Object.defineProperty(canvas, 'requestPointerLock', {
      value: vi.fn(),
      configurable: true,
    });
    const manager = new InputManager(canvas);

    vi.spyOn(manager.keyboardHandler, 'isKeyDown').mockImplementation((key) => key === 'keyw' || key === 'keyd');

    expect(manager.readVerticalAxis()).toBe(-1);
    expect(manager.readHorizontalAxis()).toBe(1);
    manager.dispose();
  });
});
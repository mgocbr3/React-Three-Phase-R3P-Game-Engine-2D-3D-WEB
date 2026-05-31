import { afterEach, describe, expect, it } from 'vitest';

import KeyboardHandler from './KeyboardHandler.js';

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

const installBrowserTargets = (visibilityState = 'visible') => {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  Object.defineProperty(documentTarget, 'visibilityState', {
    value: visibilityState,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: windowTarget,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: documentTarget,
    configurable: true,
  });
  return { windowTarget, documentTarget };
};

const makeKeyboardEvent = (type: string, key: string, shiftKey = false, code = ''): KeyboardEvent => {
  const event = new Event(type) as KeyboardEvent;
  Object.defineProperties(event, {
    key: { value: key },
    code: { value: code },
    shiftKey: { value: shiftKey },
  });
  return event;
};

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: originalDocument,
    configurable: true,
  });
});

describe('KeyboardHandler', () => {
  it('clears held keys when the browser window loses focus', () => {
    const { windowTarget } = installBrowserTargets();
    const keyboard = new KeyboardHandler();

    windowTarget.dispatchEvent(makeKeyboardEvent('keydown', 'w', true));
    expect(keyboard.isKeyDown('w')).toBe(true);
    expect(keyboard.isShiftDown()).toBe(true);

    windowTarget.dispatchEvent(new Event('blur'));

    expect(keyboard.isKeyDown('w')).toBe(false);
    expect(keyboard.isShiftDown()).toBe(false);
    keyboard.dispose();
  });

  it('clears held keys when the document becomes hidden', () => {
    const { windowTarget, documentTarget } = installBrowserTargets();
    const keyboard = new KeyboardHandler();

    windowTarget.dispatchEvent(makeKeyboardEvent('keydown', 'd'));
    expect(keyboard.isKeyDown('d')).toBe(true);

    Object.defineProperty(documentTarget, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    documentTarget.dispatchEvent(new Event('visibilitychange'));

    expect(keyboard.isKeyDown('d')).toBe(false);
    keyboard.dispose();
  });

  it('tracks both key values and physical key codes', () => {
    const { windowTarget } = installBrowserTargets();
    const keyboard = new KeyboardHandler();

    windowTarget.dispatchEvent(makeKeyboardEvent('keydown', 'z', false, 'KeyW'));

    expect(keyboard.isKeyDown('z')).toBe(true);
    expect(keyboard.isKeyDown('keyw')).toBe(true);

    windowTarget.dispatchEvent(makeKeyboardEvent('keyup', 'z', false, 'KeyW'));

    expect(keyboard.isKeyDown('z')).toBe(false);
    expect(keyboard.isKeyDown('keyw')).toBe(false);
    keyboard.dispose();
  });
});
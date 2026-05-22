// Adapted from tools/vendor/three-game-engine/src/Util.ts
// (MIT, WesUnwin/three-game-engine).

type AnyFn = (...args: unknown[]) => unknown;

class Util {
  static debounce<F extends AnyFn>(func: F, wait = 0, immediate = false): F {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const wrapped = function (this: unknown, ...args: unknown[]) {
      const context = this;

      const later = () => {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };

      const callNow = immediate && timeout === null;

      if (timeout !== null) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };

    return wrapped as unknown as F;
  }

  static isElectron(): boolean {
    return typeof window !== 'undefined'
      && Boolean(window.navigator?.userAgent?.includes('Electron/'));
  }

  // eg. getRandomNumber(3) will return 0, 1, or 2
  static getRandomNumber(max: number): number {
    return Math.floor(Math.random() * max);
  }

  static getUUID(): string {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
      const n = Number(c);
      const byte = crypto.getRandomValues(new Uint8Array(1))[0];
      return (n ^ (byte & (15 >> (n / 4)))).toString(16);
    });
  }
}

export default Util;

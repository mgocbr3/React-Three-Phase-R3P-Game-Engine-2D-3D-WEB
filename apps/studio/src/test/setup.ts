import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom's localStorage exists, but the vitest harness occasionally hands zustand
// `persist` a broken storage handle (see the `--localstorage-file` warning in
// `pnpm test` output). Force a clean Map-backed shim so zustand can always
// `setItem`/`getItem`/`removeItem` without crashing. This fixes:
//   `TypeError: storage.setItem is not a function`
// in src/services/localProjectFiles.test.ts.
const makeMemoryStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
};

const ensureStorage = (target: Window & typeof globalThis, prop: 'localStorage' | 'sessionStorage') => {
  const existing = (target as unknown as Record<string, unknown>)[prop];
  if (
    !existing ||
    typeof (existing as Partial<Storage>).setItem !== 'function' ||
    typeof (existing as Partial<Storage>).getItem !== 'function'
  ) {
    Object.defineProperty(target, prop, {
      configurable: true,
      writable: true,
      value: makeMemoryStorage(),
    });
  }
};

ensureStorage(window as Window & typeof globalThis, 'localStorage');
ensureStorage(window as Window & typeof globalThis, 'sessionStorage');
if (typeof globalThis !== 'undefined') {
  ensureStorage(globalThis as unknown as Window & typeof globalThis, 'localStorage');
  ensureStorage(globalThis as unknown as Window & typeof globalThis, 'sessionStorage');
}

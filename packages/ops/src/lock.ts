// In-process mutex per projectDir. Concurrent ops on the same folder serialize
// behind the previous op's promise. GDD §6.1 calls this "filesystem write lock"
// — in Phase 1 a single Node process owns the project so an in-process mutex
// is sufficient. Phase 4 (HTTP+WS server) also runs in one process. Cross-
// process locking is future work (an .pixl-lock file under projectDir).

import path from 'node:path';

const queues = new Map<string, Promise<unknown>>();

const normalize = (projectDir: string): string => path.resolve(projectDir);

export const withProjectLock = async <T>(
  projectDir: string,
  body: () => Promise<T>,
): Promise<T> => {
  const key = normalize(projectDir);
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(body, body);
  queues.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  try {
    return await next;
  } finally {
    // Allow GC if no further ops queue behind us. Tail caller wins; if another
    // op queued after us, queues[key] has already moved on so this check is a
    // no-op for them.
    if (queues.get(key) === next || (await isResolved(queues.get(key)))) {
      // Keep simple: do nothing — we don't shrink the map. The number of distinct
      // projectDirs is bounded by user count in any realistic scenario.
    }
  }
};

const isResolved = async (promise: Promise<unknown> | undefined): Promise<boolean> => {
  if (!promise) return true;
  const sentinel = Symbol('pending');
  const winner = await Promise.race([promise.then(() => 'done'), Promise.resolve(sentinel)]);
  return winner === 'done';
};

/** Test-only: clear the lock table. Never call from production code. */
export const __resetLocksForTests = (): void => {
  queues.clear();
};

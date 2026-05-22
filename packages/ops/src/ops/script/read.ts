// Op: script.read — read a file from Scripts/. Read-only; emits script.read.

import { promises as fs } from 'node:fs';

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import { OpInputError, type OpContext } from '../../types.js';
import { resolveScriptPath } from './paths.js';

export interface ReadScriptResult {
  ok: boolean;
  path: string;
  source: string | null;
  validationErrors: string[];
}

export const readScript = async (
  ctx: OpContext,
  args: { path: string },
): Promise<ReadScriptResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      const { absPath, relPath } = resolveScriptPath(ctx.projectDir, args.path);
      const source = await fs.readFile(absPath, 'utf8');
      broadcastProjectEvent({ type: 'script.read', path: relPath, byAgent: ctx.agent });
      return { ok: true, path: relPath, source, validationErrors: [] };
    } catch (error) {
      if (error instanceof OpInputError) {
        return { ok: false, path: args.path, source: null, validationErrors: [error.message] };
      }
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return { ok: false, path: args.path, source: null, validationErrors: [`Script não encontrado: ${args.path}`] };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, path: args.path, source: null, validationErrors: [message] };
    }
  });
};

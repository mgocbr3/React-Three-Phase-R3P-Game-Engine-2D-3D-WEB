// Op: script.delete — unlink a file under Scripts/.

import { promises as fs } from 'node:fs';

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';
import { resolveScriptPath } from './paths.js';

export const deleteScript = async (
  ctx: OpContext,
  args: { path: string },
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      const { absPath, relPath } = resolveScriptPath(ctx.projectDir, args.path);
      try {
        await fs.unlink(absPath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          return {
            ok: false,
            changedFiles: [],
            contentHash: '',
            validationWarnings: [],
            validationErrors: [`Script não encontrado: ${args.path}`],
          };
        }
        throw error;
      }
      broadcastProjectEvent({
        type: 'script.deleted',
        path: relPath,
        contentHash: '',
        byAgent: ctx.agent,
      });
      return {
        ok: true,
        changedFiles: [relPath],
        contentHash: '',
        validationWarnings: [],
        validationErrors: [],
      };
    } catch (error) {
      if (error instanceof OpInputError) {
        return {
          ok: false,
          changedFiles: [],
          contentHash: '',
          validationWarnings: [],
          validationErrors: [error.message],
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        changedFiles: [],
        contentHash: '',
        validationWarnings: [],
        validationErrors: [message],
      };
    }
  });
};

// Op: script.write — atomic write a file under Scripts/. Creates parent dirs.

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { sha256OfString } from '@pixlland/engine-core';

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';
import { resolveScriptPath } from './paths.js';

export interface WriteScriptArgs {
  path: string;
  source: string;
}

export const writeScript = async (
  ctx: OpContext,
  args: WriteScriptArgs,
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      if (typeof args.source !== 'string') {
        throw new OpInputError('source deve ser string.');
      }
      const { absPath, relPath } = resolveScriptPath(ctx.projectDir, args.path);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      const tmp = `${absPath}.tmp-${process.pid}-${Date.now()}`;
      await fs.writeFile(tmp, args.source, 'utf8');
      await fs.rename(tmp, absPath);
      const contentHash = await sha256OfString(args.source);
      broadcastProjectEvent({
        type: 'script.written',
        path: relPath,
        contentHash,
        byAgent: ctx.agent,
      });
      return {
        ok: true,
        changedFiles: [relPath],
        contentHash,
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

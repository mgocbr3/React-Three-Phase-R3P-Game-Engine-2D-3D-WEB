// Op: project.pack — bundle the project folder into a single .pixl archive.
// Delegates byte-level work to @pixlland/engine-core. Reads from disk via the
// `node` subpath (no browser pulls in fs).

import path from 'node:path';
import { promises as fs } from 'node:fs';

import { packProject as corePackProject } from '@pixlland/engine-core';
// @pixlland/engine-core/node is the Node-only file IO subpath.
// eslint-disable-next-line import/no-unresolved
import { readProjectFolder, writeBytesToFile } from '@pixlland/engine-core/node';

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface PackProjectArgs {
  outPath: string;
  /** Override packedAt for deterministic output (tests). */
  packedAt?: number;
}

export const packProject = async (
  ctx: OpContext,
  args: PackProjectArgs,
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      if (!args.outPath) {
        throw new OpInputError('outPath é obrigatório.');
      }
      const absOut = path.resolve(args.outPath);
      const files = await readProjectFolder(ctx.projectDir);
      const { bytes, manifest } = await corePackProject({ files, packedAt: args.packedAt });
      await fs.mkdir(path.dirname(absOut), { recursive: true });
      await writeBytesToFile(absOut, bytes);
      broadcastProjectEvent({
        type: 'project.packed',
        projectDir: ctx.projectDir,
        outPath: absOut,
        contentHash: manifest.contentHash,
        byAgent: ctx.agent,
      });
      return {
        ok: true,
        changedFiles: [absOut],
        contentHash: manifest.contentHash,
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

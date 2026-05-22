// Op: project.unpack — extract a .pixl archive into a project folder.

import path from 'node:path';

import { unpackPackage } from '@pixlland/engine-core';
// eslint-disable-next-line import/no-unresolved
import { readBytesFromFile, writeProjectFolder } from '@pixlland/engine-core/node';

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface UnpackProjectArgs {
  sourcePath: string;
}

export const unpackProject = async (
  ctx: OpContext,
  args: UnpackProjectArgs,
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      if (!args.sourcePath) {
        throw new OpInputError('sourcePath é obrigatório.');
      }
      const absSrc = path.resolve(args.sourcePath);
      const bytes = await readBytesFromFile(absSrc);
      const { manifest, files } = await unpackPackage(bytes);
      await writeProjectFolder(ctx.projectDir, files);
      broadcastProjectEvent({
        type: 'project.unpacked',
        projectDir: ctx.projectDir,
        sourcePath: absSrc,
        contentHash: manifest.contentHash,
        byAgent: ctx.agent,
      });
      return {
        ok: true,
        changedFiles: files.map((f) => f.path),
        contentHash: manifest.contentHash,
        validationWarnings: [],
        validationErrors: [],
      };
    } catch (error) {
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

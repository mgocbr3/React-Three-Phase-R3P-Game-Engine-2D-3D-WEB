// Op: asset.remove — drop an entry from doc.assets.entries.
// Does NOT delete the file on disk; bytes management is out of scope.

import { runLocked } from '../../runLocked.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export const removeAsset = async (
  ctx: OpContext,
  args: { assetId: string },
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.assetId) throw new OpInputError('assetId é obrigatório.');
    const entries = doc.assets?.entries ?? [];
    if (!entries.some((e) => e.id === args.assetId)) {
      throw new OpInputError(`Asset não encontrado: ${args.assetId}.`);
    }
    const next = {
      ...doc,
      assets: {
        ...(doc.assets ?? { root: 'Assets', folders: [], entries: [] }),
        entries: entries.filter((e) => e.id !== args.assetId),
      },
    };
    return {
      next,
      event: (contentHash) => ({
        type: 'asset.removed',
        assetId: args.assetId,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

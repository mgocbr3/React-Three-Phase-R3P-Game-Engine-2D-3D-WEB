// Op: scene.setActive — update activeSceneId.

import { runLocked } from '../../runLocked.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export const setActiveScene = async (
  ctx: OpContext,
  args: { sceneId: string },
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!doc.scenes.some((s) => s.id === args.sceneId)) {
      throw new OpInputError(`Scene não encontrada: ${args.sceneId}.`);
    }
    if (doc.activeSceneId === args.sceneId) {
      // No-op but still succeed (idempotent) — return same doc so hash stays.
      return {
        next: doc,
        event: (contentHash) => ({
          type: 'scene.activated',
          sceneId: args.sceneId,
          contentHash,
          byAgent: ctx.agent,
        }),
      };
    }
    const next = { ...doc, activeSceneId: args.sceneId };
    return {
      next,
      event: (contentHash) => ({
        type: 'scene.activated',
        sceneId: args.sceneId,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

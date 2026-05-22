// Op: scene.delete — refuses if scene is active or last remaining.

import { runLocked } from '../../runLocked.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export const deleteScene = async (
  ctx: OpContext,
  args: { sceneId: string },
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!doc.scenes.some((s) => s.id === args.sceneId)) {
      throw new OpInputError(`Scene não encontrada: ${args.sceneId}.`);
    }
    if (doc.scenes.length === 1) {
      throw new OpInputError('Não é possível deletar a única cena do projeto.');
    }
    if (doc.activeSceneId === args.sceneId) {
      throw new OpInputError(
        `Cena ${args.sceneId} está ativa. Use setActiveScene para mudar antes de deletar.`,
      );
    }
    const next = {
      ...doc,
      scenes: doc.scenes.filter((s) => s.id !== args.sceneId),
    };
    return {
      next,
      event: (contentHash) => ({
        type: 'scene.deleted',
        sceneId: args.sceneId,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

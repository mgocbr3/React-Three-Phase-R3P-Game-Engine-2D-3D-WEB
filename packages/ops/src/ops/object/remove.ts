// Op: object.remove — drop an object and all of its descendants.

import {
  findObjectInDoc,
  removeObjectFromScene,
  replaceScene,
} from '../../objectTree.js';
import { runLocked } from '../../runLocked.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export const removeObject = async (
  ctx: OpContext,
  args: { sceneId: string; objectId: string },
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!args.objectId) throw new OpInputError('objectId é obrigatório.');

    const found = findObjectInDoc(doc, args.objectId);
    if (!found || found.scene.id !== args.sceneId) {
      throw new OpInputError(`Object não encontrado na scene ${args.sceneId}: ${args.objectId}.`);
    }
    const { scene: nextScene, removed } = removeObjectFromScene(found.scene, args.objectId);
    if (!removed) {
      throw new OpInputError(`Falha removendo object ${args.objectId} (estado inconsistente).`);
    }

    return {
      next: replaceScene(doc, args.sceneId, nextScene),
      event: (contentHash) => ({
        type: 'object.removed',
        sceneId: args.sceneId,
        objectId: args.objectId,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

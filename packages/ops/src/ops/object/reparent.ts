// Op: object.reparent — move an object (and its subtree) to a new parent.
// Refuses if newParentId is the object itself or one of its descendants
// (would create a cycle).

import {
  addChildObject,
  addRootObject,
  descendantIds,
  findObjectInDoc,
  findObjectInScene,
  removeObjectFromScene,
  replaceScene,
} from '../../objectTree.js';
import { runLocked } from '../../runLocked.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export const reparentObject = async (
  ctx: OpContext,
  args: { sceneId: string; objectId: string; newParentId: string | null },
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!args.objectId) throw new OpInputError('objectId é obrigatório.');

    const found = findObjectInDoc(doc, args.objectId);
    if (!found || found.scene.id !== args.sceneId) {
      throw new OpInputError(`Object não encontrado na scene ${args.sceneId}: ${args.objectId}.`);
    }

    if (args.newParentId === args.objectId) {
      throw new OpInputError('Não é possível reparent para o próprio object.');
    }
    if (args.newParentId !== null) {
      const newParent = findObjectInScene(found.scene, args.newParentId);
      if (!newParent) {
        throw new OpInputError(`newParentId não encontrado: ${args.newParentId}.`);
      }
      // Cycle check: newParentId must NOT be a descendant of objectId.
      const subtree = descendantIds(found.object);
      if (subtree.includes(args.newParentId)) {
        throw new OpInputError(
          `newParentId ${args.newParentId} é descendente de ${args.objectId} — criaria ciclo.`,
        );
      }
    }

    // Detach the object's subtree.
    const objectCopy = found.object;
    const { scene: detached } = removeObjectFromScene(found.scene, args.objectId);
    // Attach with updated parentId.
    const reattached: typeof objectCopy = { ...objectCopy, parentId: args.newParentId };
    let nextScene = detached;
    if (args.newParentId === null) {
      nextScene = addRootObject(detached, reattached);
    } else {
      const result = addChildObject(detached, args.newParentId, reattached);
      if (!result.found) {
        throw new OpInputError(`newParentId não encontrado após detach: ${args.newParentId}.`);
      }
      nextScene = result.scene;
    }

    return {
      next: replaceScene(doc, args.sceneId, nextScene),
      event: (contentHash) => ({
        type: 'object.reparented',
        sceneId: args.sceneId,
        objectId: args.objectId,
        newParentId: args.newParentId,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

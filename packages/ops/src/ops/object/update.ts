// Op: object.update — patch high-level object fields (name, visible, locked,
// tags, data). Transform and components have dedicated ops; this is for
// "metadata" only.

import {
  findObjectInDoc,
  replaceScene,
  updateObjectInScene,
} from '../../objectTree.js';
import { runLocked } from '../../runLocked.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface UpdateObjectArgs {
  sceneId: string;
  objectId: string;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  tags?: string[];
  data?: Record<string, unknown>;
}

export const updateObject = async (
  ctx: OpContext,
  args: UpdateObjectArgs,
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!args.objectId) throw new OpInputError('objectId é obrigatório.');

    const found = findObjectInDoc(doc, args.objectId);
    if (!found || found.scene.id !== args.sceneId) {
      throw new OpInputError(`Object não encontrado na scene ${args.sceneId}: ${args.objectId}.`);
    }

    const fieldsTouched: string[] = [];
    const { scene: nextScene } = updateObjectInScene(found.scene, args.objectId, (object) => {
      const patched = { ...object };
      if (args.name !== undefined) { patched.name = args.name; fieldsTouched.push('name'); }
      if (args.visible !== undefined) { patched.visible = args.visible; fieldsTouched.push('visible'); }
      if (args.locked !== undefined) { patched.locked = args.locked; fieldsTouched.push('locked'); }
      if (args.tags !== undefined) { patched.tags = [...args.tags]; fieldsTouched.push('tags'); }
      if (args.data !== undefined) { patched.data = { ...args.data }; fieldsTouched.push('data'); }
      return patched;
    });

    if (fieldsTouched.length === 0) {
      throw new OpInputError('Nenhum campo informado para update.');
    }

    return {
      next: replaceScene(doc, args.sceneId, nextScene),
      event: (contentHash) => ({
        type: 'object.updated',
        sceneId: args.sceneId,
        objectId: args.objectId,
        fields: fieldsTouched,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

// Op: object.setTransform — replace position/rotation/scale partially or
// fully. Unspecified components keep their previous values.

import {
  findObjectInDoc,
  replaceScene,
  updateObjectInScene,
} from '../../objectTree.js';
import { runLocked } from '../../runLocked.js';
import type { PixlVec3 } from '../../schema.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface SetObjectTransformArgs {
  sceneId: string;
  objectId: string;
  position?: PixlVec3;
  rotation?: PixlVec3;
  scale?: PixlVec3;
}

const isFiniteVec3 = (value: unknown): value is PixlVec3 =>
  Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n));

export const setObjectTransform = async (
  ctx: OpContext,
  args: SetObjectTransformArgs,
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!args.objectId) throw new OpInputError('objectId é obrigatório.');
    if (
      args.position === undefined &&
      args.rotation === undefined &&
      args.scale === undefined
    ) {
      throw new OpInputError('Informe ao menos position, rotation ou scale.');
    }
    if (args.position !== undefined && !isFiniteVec3(args.position)) {
      throw new OpInputError('position deve ser PixlVec3 finito.');
    }
    if (args.rotation !== undefined && !isFiniteVec3(args.rotation)) {
      throw new OpInputError('rotation deve ser PixlVec3 finito.');
    }
    if (args.scale !== undefined && !isFiniteVec3(args.scale)) {
      throw new OpInputError('scale deve ser PixlVec3 finito.');
    }

    const found = findObjectInDoc(doc, args.objectId);
    if (!found || found.scene.id !== args.sceneId) {
      throw new OpInputError(`Object não encontrado na scene ${args.sceneId}: ${args.objectId}.`);
    }

    const { scene: nextScene } = updateObjectInScene(found.scene, args.objectId, (object) => {
      const transform = { ...object.transform };
      if (args.position !== undefined) transform.position = args.position;
      if (args.rotation !== undefined) transform.rotation = args.rotation;
      if (args.scale !== undefined) transform.scale = args.scale;
      return { ...object, transform };
    });

    return {
      next: replaceScene(doc, args.sceneId, nextScene),
      event: (contentHash) => ({
        type: 'object.transformed',
        sceneId: args.sceneId,
        objectId: args.objectId,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

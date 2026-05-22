// Op: object.add — append a new PixlSceneObject to a scene.

import { generateId } from '../../ids.js';
import {
  addChildObject,
  addRootObject,
  findObjectInScene,
  findScene,
  replaceScene,
} from '../../objectTree.js';
import { runLocked } from '../../runLocked.js';
import {
  type PixlComponentInstance,
  type PixlSceneObjectShape,
  type PixlVec3,
} from '../../schema.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface AddObjectArgs {
  sceneId: string;
  parentId: string | null;
  type: string;
  name?: string;
  transform?: {
    position?: PixlVec3;
    rotation?: PixlVec3;
    scale?: PixlVec3;
  };
  components?: Array<{
    id?: string;
    type: string;
    enabled?: boolean;
    data?: Record<string, unknown>;
  }>;
  tags?: string[];
  visible?: boolean;
  locked?: boolean;
  data?: Record<string, unknown>;
  /** Optional fixed id (tests). */
  id?: string;
}

const normalizeComponent = (
  raw: NonNullable<AddObjectArgs['components']>[number],
): PixlComponentInstance => ({
  id: raw.id ?? generateId('cmp'),
  type: raw.type,
  enabled: raw.enabled ?? true,
  data: raw.data ?? {},
});

export const addObject = async (
  ctx: OpContext,
  args: AddObjectArgs,
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!args.type) throw new OpInputError('type é obrigatório.');

    const scene = findScene(doc, args.sceneId);
    if (!scene) throw new OpInputError(`Scene não encontrada: ${args.sceneId}.`);
    if (args.parentId && !findObjectInScene(scene, args.parentId)) {
      throw new OpInputError(`parentId não encontrado na scene: ${args.parentId}.`);
    }

    const id = args.id ?? generateId('obj');
    if (findObjectInScene(scene, id)) {
      throw new OpInputError(`Object id já existe: ${id}.`);
    }

    const newObject: PixlSceneObjectShape = {
      id,
      name: args.name ?? args.type,
      type: args.type,
      parentId: args.parentId,
      transform: args.transform ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      visible: args.visible ?? true,
      locked: args.locked ?? false,
      tags: args.tags ?? [],
      components: (args.components ?? []).map(normalizeComponent),
      data: args.data ?? {},
    };

    let nextScene = scene;
    if (args.parentId === null) {
      nextScene = addRootObject(scene, newObject);
    } else {
      const result = addChildObject(scene, args.parentId, newObject);
      if (!result.found) {
        throw new OpInputError(`parentId não encontrado: ${args.parentId}.`);
      }
      nextScene = result.scene;
    }

    return {
      next: replaceScene(doc, args.sceneId, nextScene),
      event: (contentHash) => ({
        type: 'object.added',
        sceneId: args.sceneId,
        objectId: id,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

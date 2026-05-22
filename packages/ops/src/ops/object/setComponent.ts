// Op: object.setComponent — add, update, or remove a component on an object.
// Action is implied by the args:
//   - args.componentId NOT in object.components AND data present → add
//   - args.componentId IN object.components AND data present → update
//   - args.componentId IN object.components AND data === null → remove

import { generateId } from '../../ids.js';
import {
  findObjectInDoc,
  replaceScene,
  updateObjectInScene,
} from '../../objectTree.js';
import { runLocked } from '../../runLocked.js';
import type { PixlComponentInstance } from '../../schema.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface SetObjectComponentArgs {
  sceneId: string;
  objectId: string;
  /** Existing component id to update/remove, or omitted/new to add. */
  componentId?: string;
  /** Required for add. May be omitted for update (keeps existing type). */
  type?: string;
  enabled?: boolean;
  /** Set to `null` to REMOVE the component (only valid with existing componentId). */
  data?: Record<string, unknown> | null;
}

type Action = 'added' | 'updated' | 'removed';

export const setObjectComponent = async (
  ctx: OpContext,
  args: SetObjectComponentArgs,
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.sceneId) throw new OpInputError('sceneId é obrigatório.');
    if (!args.objectId) throw new OpInputError('objectId é obrigatório.');

    const found = findObjectInDoc(doc, args.objectId);
    if (!found || found.scene.id !== args.sceneId) {
      throw new OpInputError(`Object não encontrado na scene ${args.sceneId}: ${args.objectId}.`);
    }

    let action: Action | null = null;
    let resolvedComponentId = '';
    const { scene: nextScene } = updateObjectInScene(found.scene, args.objectId, (object) => {
      const components = object.components ?? [];
      const existingIndex = args.componentId
        ? components.findIndex((c) => c.id === args.componentId)
        : -1;

      // REMOVE
      if (args.data === null) {
        if (existingIndex < 0) {
          throw new OpInputError(
            `Componente não encontrado para remover: ${String(args.componentId)}.`,
          );
        }
        action = 'removed';
        resolvedComponentId = components[existingIndex].id;
        const next = [...components];
        next.splice(existingIndex, 1);
        return { ...object, components: next };
      }

      // UPDATE
      if (existingIndex >= 0) {
        const current = components[existingIndex];
        const patched: PixlComponentInstance = {
          id: current.id,
          type: args.type ?? current.type,
          enabled: args.enabled ?? current.enabled,
          data: args.data === undefined ? current.data : { ...args.data },
        };
        const next = [...components];
        next[existingIndex] = patched;
        action = 'updated';
        resolvedComponentId = patched.id;
        return { ...object, components: next };
      }

      // ADD
      if (!args.type) {
        throw new OpInputError('type é obrigatório para adicionar um novo componente.');
      }
      const newCmp: PixlComponentInstance = {
        id: args.componentId ?? generateId('cmp'),
        type: args.type,
        enabled: args.enabled ?? true,
        data: args.data ?? {},
      };
      action = 'added';
      resolvedComponentId = newCmp.id;
      return { ...object, components: [...components, newCmp] };
    });

    if (action === null) {
      throw new OpInputError('setObjectComponent: nenhuma ação aplicada.');
    }
    const finalAction: Action = action;
    const finalComponentId: string = resolvedComponentId;

    return {
      next: replaceScene(doc, args.sceneId, nextScene),
      event: (contentHash) => ({
        type: 'object.component.set',
        sceneId: args.sceneId,
        objectId: args.objectId,
        componentId: finalComponentId,
        action: finalAction,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

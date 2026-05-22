// Op: scene.create — add a new scene to the project doc.

import { generateId } from '../../ids.js';
import { runLocked } from '../../runLocked.js';
import {
  type PixlSceneKind,
  type PixlSceneShape,
} from '../../schema.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface CreateSceneArgs {
  name: string;
  kind: PixlSceneKind;
  /** If true, the new scene becomes the active scene. Default false. */
  activate?: boolean;
  /** Optional fixed id (tests). */
  id?: string;
}

const SCENE_KINDS: PixlSceneKind[] = ['2d', '3d', 'hybrid'];

const cameraFor = (kind: PixlSceneKind): PixlSceneShape['camera'] => {
  if (kind === '2d') return { id: 'cam-2d', name: 'Camera 2D', position: [0, 0, 0], target: [0, 0, 0] };
  if (kind === '3d') {
    return { id: 'cam-3d', name: 'Camera 3D', position: [10, 8, 10], target: [0, 0, 0], fov: 50, near: 0.1, far: 1000 };
  }
  return { id: 'cam-hybrid', name: 'Camera', position: [10, 8, 10], target: [0, 0, 0] };
};

const physicsFor = (kind: PixlSceneKind): PixlSceneShape['physics'] => {
  if (kind === '2d') return { engine: 'arcade', gravity: [0, 980] };
  if (kind === '3d') return { engine: 'rapier', gravity: [0, -9.81, 0] };
  return { engine: 'rapier', gravity: [0, -9.81, 0] };
};

export const createScene = async (
  ctx: OpContext,
  args: CreateSceneArgs,
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.name || args.name.trim().length === 0) {
      throw new OpInputError('name é obrigatório.');
    }
    if (!SCENE_KINDS.includes(args.kind)) {
      throw new OpInputError(`kind inválido: ${String(args.kind)}.`);
    }
    const id = args.id ?? generateId('scene');
    if (doc.scenes.some((s) => s.id === id)) {
      throw new OpInputError(`Scene id já existe: ${id}.`);
    }
    const newScene: PixlSceneShape = {
      id,
      name: args.name,
      kind: args.kind,
      rootObjects: [],
      camera: cameraFor(args.kind),
      environment: { background: args.kind === '2d' ? '#101822' : '#87ceeb' },
      physics: physicsFor(args.kind),
    };
    const next = {
      ...doc,
      scenes: [...doc.scenes, newScene],
      activeSceneId: args.activate ? id : doc.activeSceneId,
    };
    return {
      next,
      event: (contentHash) => ({
        type: 'scene.created',
        sceneId: id,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

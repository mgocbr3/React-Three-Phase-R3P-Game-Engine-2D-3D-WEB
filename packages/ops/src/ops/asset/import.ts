// Op: asset.import — register an asset entry in doc.assets.entries. Does NOT
// move bytes; assets are expected to already exist under Assets/ on disk.
// Calling import is what makes the editor/runtime *aware* of them.

import { generateId } from '../../ids.js';
import { runLocked } from '../../runLocked.js';
import type { PixlAssetEntryShape } from '../../schema.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';

export interface ImportAssetArgs {
  name: string;
  /** Relative path under projectDir (POSIX). Eg "Assets/3D_Models/tree.glb". */
  path: string;
  /** glb / gltf / png / wav / etc. */
  kind: string;
  url?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Optional fixed id (tests). */
  id?: string;
}

export const importAsset = async (
  ctx: OpContext,
  args: ImportAssetArgs,
): Promise<OpResult> => {
  return runLocked(ctx, (doc) => {
    if (!args.name) throw new OpInputError('name é obrigatório.');
    if (!args.path) throw new OpInputError('path é obrigatório.');
    if (!args.kind) throw new OpInputError('kind é obrigatório.');
    if (args.path.includes('..')) {
      throw new OpInputError(`path inválido (não pode conter ".."): ${args.path}`);
    }

    const assets = doc.assets ?? { root: 'Assets', folders: [], entries: [] };
    const entries = assets.entries ?? [];
    const id = args.id ?? generateId('asset');
    if (entries.some((e) => e.id === id)) {
      throw new OpInputError(`Asset id já existe: ${id}.`);
    }
    if (entries.some((e) => e.path === args.path)) {
      throw new OpInputError(`Já existe um asset com path ${args.path}.`);
    }

    const newEntry: PixlAssetEntryShape = {
      id,
      name: args.name,
      kind: args.kind,
      path: args.path,
      url: args.url,
      tags: args.tags ?? [],
      metadata: args.metadata ?? {},
    };
    const next = {
      ...doc,
      assets: {
        ...assets,
        entries: [...entries, newEntry],
      },
    };
    return {
      next,
      event: (contentHash) => ({
        type: 'asset.imported',
        assetId: id,
        path: args.path,
        contentHash,
        byAgent: ctx.agent,
      }),
    };
  });
};

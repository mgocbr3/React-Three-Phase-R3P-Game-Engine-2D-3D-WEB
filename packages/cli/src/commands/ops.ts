// CLI dispatcher for @pixlland/engine-ops.
//
// Two surfaces:
//   pixl-engine ops list
//   pixl-engine ops <op-name> <projectDir> [--key value]...
//
// All args after <projectDir> are parsed as repeated --key=value or --key value
// pairs. Values are interpreted by an opinionated coercer:
//   true / false → boolean
//   null         → null
//   numbers (incl. negative, decimals) → number
//   anything else → string
//
// JSON-only args (objects, arrays) can be passed with --key:json='{"a":1}'.

import path from 'node:path';
import {
  addObject,
  createProject,
  createScene,
  deleteScene,
  deleteScript,
  exportPhaser,
  exportPixlland,
  exportThree,
  importAsset,
  packProject,
  readScript,
  removeAsset,
  removeObject,
  reparentObject,
  setActiveScene,
  setObjectComponent,
  setObjectTransform,
  unpackProject,
  updateObject,
  validateProject,
  writeScript,
  type AgentKind,
  type OpContext,
} from '@pixlland/engine-ops';

export interface OpSchemaEntry {
  /** Canonical name as shown on the wire (e.g. "object.add"). */
  name: string;
  category: 'project' | 'scene' | 'object' | 'asset' | 'script' | 'build';
  description: string;
  /** Args parsed from --key value pairs (string values get coerced). */
  required: string[];
  optional: string[];
  /** Args that MUST come as JSON (--key:json='...'). */
  json?: string[];
}

const OPS: OpSchemaEntry[] = [
  // project
  { name: 'project.create', category: 'project',
    description: 'Scaffold a new project folder',
    required: ['name', 'kind'], optional: ['id', 'slug', 'refuseIfExists'] },
  { name: 'project.validate', category: 'project',
    description: 'Re-run schema + 2D/3D coherence check',
    required: [], optional: [] },
  { name: 'project.pack', category: 'project',
    description: 'Bundle project folder into .pixl',
    required: ['outPath'], optional: ['packedAt'] },
  { name: 'project.unpack', category: 'project',
    description: 'Extract .pixl into projectDir',
    required: ['sourcePath'], optional: [] },
  // scene
  { name: 'scene.create', category: 'scene',
    description: 'Add a new scene',
    required: ['name', 'kind'], optional: ['id', 'activate'] },
  { name: 'scene.delete', category: 'scene',
    description: 'Remove a scene (refuses active/last)',
    required: ['sceneId'], optional: [] },
  { name: 'scene.setActive', category: 'scene',
    description: 'Update activeSceneId',
    required: ['sceneId'], optional: [] },
  // object
  { name: 'object.add', category: 'object',
    description: 'Append a new object',
    required: ['sceneId', 'type'], optional: ['parentId', 'name', 'id', 'visible', 'locked'],
    json: ['transform', 'components', 'tags', 'data'] },
  { name: 'object.update', category: 'object',
    description: 'Patch object name/visible/locked/tags/data',
    required: ['sceneId', 'objectId'], optional: ['name', 'visible', 'locked'],
    json: ['tags', 'data'] },
  { name: 'object.remove', category: 'object',
    description: 'Remove object + descendants',
    required: ['sceneId', 'objectId'], optional: [] },
  { name: 'object.reparent', category: 'object',
    description: 'Move object to a new parent (or root via newParentId=null)',
    required: ['sceneId', 'objectId'], optional: ['newParentId'] },
  { name: 'object.setTransform', category: 'object',
    description: 'Replace position/rotation/scale',
    required: ['sceneId', 'objectId'], optional: [],
    json: ['position', 'rotation', 'scale'] },
  { name: 'object.setComponent', category: 'object',
    description: 'Add/update/remove a component on an object (data=null removes)',
    required: ['sceneId', 'objectId'], optional: ['componentId', 'type', 'enabled'],
    json: ['data'] },
  // asset
  { name: 'asset.import', category: 'asset',
    description: 'Register an asset entry',
    required: ['name', 'kind', 'path'], optional: ['id', 'url'],
    json: ['tags', 'metadata'] },
  { name: 'asset.remove', category: 'asset',
    description: 'Remove an asset entry',
    required: ['assetId'], optional: [] },
  // script
  { name: 'script.read', category: 'script',
    description: 'Read a file from Scripts/',
    required: ['path'], optional: [] },
  { name: 'script.write', category: 'script',
    description: 'Atomic write under Scripts/',
    required: ['path', 'source'], optional: [] },
  { name: 'script.delete', category: 'script',
    description: 'Remove a file from Scripts/',
    required: ['path'], optional: [] },
  // build (stubs)
  { name: 'build.exportThree', category: 'build',
    description: 'STUB — three-web bundle export',
    required: ['outDir'], optional: [] },
  { name: 'build.exportPhaser', category: 'build',
    description: 'STUB — phaser-web bundle export',
    required: ['outDir'], optional: [] },
  { name: 'build.exportPixlland', category: 'build',
    description: 'STUB — pixlland portal bundle export',
    required: ['outDir'], optional: [] },
];

export const listOps = (): OpSchemaEntry[] => OPS.map((entry) => ({ ...entry }));

const coerce = (value: string): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

export const parseOpArgs = (raw: string[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (!token.startsWith('--')) {
      throw new Error(`ops: argumento inválido (esperado --key): ${token}`);
    }
    let key = token.slice(2);
    let value: string;
    const eq = key.indexOf('=');
    if (eq >= 0) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else {
      const next = raw[i + 1];
      if (next === undefined || next.startsWith('--')) {
        // Bare flag → true
        result[key] = true;
        continue;
      }
      value = next;
      i += 1;
    }
    if (key.endsWith(':json')) {
      const realKey = key.slice(0, -':json'.length);
      try {
        result[realKey] = JSON.parse(value);
      } catch (error) {
        throw new Error(`ops: --${key}=... não é JSON válido: ${(error as Error).message}`);
      }
    } else {
      result[key] = coerce(value);
    }
  }
  return result;
};

export interface RunOpsCallOptions {
  agent?: AgentKind;
}

type OpHandler = (ctx: OpContext, args: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Record<string, OpHandler> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'project.create': (ctx, args) => createProject(ctx, args as any),
  'project.validate': (ctx) => validateProject(ctx),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'project.pack': (ctx, args) => packProject(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'project.unpack': (ctx, args) => unpackProject(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'scene.create': (ctx, args) => createScene(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'scene.delete': (ctx, args) => deleteScene(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'scene.setActive': (ctx, args) => setActiveScene(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'object.add': (ctx, args) => addObject(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'object.update': (ctx, args) => updateObject(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'object.remove': (ctx, args) => removeObject(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'object.reparent': (ctx, args) => reparentObject(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'object.setTransform': (ctx, args) => setObjectTransform(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'object.setComponent': (ctx, args) => setObjectComponent(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'asset.import': (ctx, args) => importAsset(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'asset.remove': (ctx, args) => removeAsset(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'script.read': (ctx, args) => readScript(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'script.write': (ctx, args) => writeScript(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'script.delete': (ctx, args) => deleteScript(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'build.exportThree': (ctx, args) => exportThree(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'build.exportPhaser': (ctx, args) => exportPhaser(ctx, args as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'build.exportPixlland': (ctx, args) => exportPixlland(ctx, args as any),
};

export const isKnownOp = (name: string): boolean => name in HANDLERS;

export const runOpsCall = async (
  opName: string,
  projectDir: string,
  args: Record<string, unknown>,
  options: RunOpsCallOptions = {},
): Promise<unknown> => {
  const handler = HANDLERS[opName];
  if (!handler) {
    throw new Error(`ops: nome de op desconhecido: ${opName}. Rode "pixl-engine ops list".`);
  }
  if (!projectDir) {
    throw new Error('ops: projectDir obrigatório (segundo argumento).');
  }
  const ctx: OpContext = {
    projectDir: path.resolve(projectDir),
    agent: options.agent ?? 'cli',
  };
  return handler(ctx, args);
};

export const printOpsList = (entries: OpSchemaEntry[]): void => {
  console.log(JSON.stringify(entries, null, 2));
};

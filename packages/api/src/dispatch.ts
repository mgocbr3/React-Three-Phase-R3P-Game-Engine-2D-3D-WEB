// HTTP-flavored dispatcher into @pixlland/engine-ops. Mirrors the MCP
// dispatcher (engine-mcp/src/tools.ts) but uses agent='http'.

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
  type OpContext,
} from '@pixlland/engine-ops';

export const KNOWN_OPS = [
  'project.create',
  'project.validate',
  'project.pack',
  'project.unpack',
  'scene.create',
  'scene.delete',
  'scene.setActive',
  'object.add',
  'object.update',
  'object.remove',
  'object.reparent',
  'object.setTransform',
  'object.setComponent',
  'asset.import',
  'asset.remove',
  'script.read',
  'script.write',
  'script.delete',
  'build.exportThree',
  'build.exportPhaser',
  'build.exportPixlland',
] as const;

export type KnownOpName = (typeof KNOWN_OPS)[number];

export const isKnownOp = (value: string): value is KnownOpName =>
  (KNOWN_OPS as readonly string[]).includes(value);

const handlers: Record<KnownOpName, (ctx: OpContext, args: Record<string, unknown>) => Promise<unknown>> = {
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

export interface DispatchResult {
  status: number;
  body: unknown;
}

export const dispatchHttp = async (
  name: string,
  body: Record<string, unknown>,
): Promise<DispatchResult> => {
  if (!isKnownOp(name)) {
    return {
      status: 404,
      body: { ok: false, validationErrors: [`Op desconhecida: ${name}`] },
    };
  }
  const projectDir = body.projectDir;
  if (typeof projectDir !== 'string' || projectDir.length === 0) {
    return {
      status: 400,
      body: {
        ok: false,
        validationErrors: ['projectDir é obrigatório no body (string).'],
      },
    };
  }
  const { projectDir: _, ...rest } = body;
  void _;
  const ctx: OpContext = { projectDir, agent: 'http' };
  const result = (await handlers[name](ctx, rest)) as { ok: boolean };
  return { status: result.ok === false ? 400 : 200, body: result };
};

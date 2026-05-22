// MCP tool dispatcher. Pure functions — no transport. The server (server.ts)
// and the tests both consume `callOpTool`.

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
  type OpResult,
} from '@pixlland/engine-ops';

import { findTool, TOOL_CATALOG } from './schemas.js';

export interface ToolArgs {
  projectDir?: unknown;
  [key: string]: unknown;
}

export interface ToolResultPayload {
  /** True if the underlying op returned ok:true. False on op failure or input error. */
  isError: boolean;
  /** The OpResult shape (for mutating ops) or a custom shape (for read ops like script.read). */
  result: unknown;
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const handlers: Record<string, (ctx: OpContext, args: ToolArgs) => Promise<unknown>> = {
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

export const callOpTool = async (
  name: string,
  args: ToolArgs,
): Promise<ToolResultPayload> => {
  const tool = findTool(name);
  if (!tool) {
    return {
      isError: true,
      result: { ok: false, validationErrors: [`Tool desconhecida: ${name}`] },
    };
  }
  if (!isString(args.projectDir)) {
    return {
      isError: true,
      result: {
        ok: false,
        validationErrors: ['projectDir é obrigatório (string).'],
      },
    };
  }
  const handler = handlers[name];
  if (!handler) {
    // Should never happen if findTool + handlers are kept in sync — defensive.
    return {
      isError: true,
      result: { ok: false, validationErrors: [`Handler não registrado: ${name}`] },
    };
  }
  const { projectDir, ...rest } = args;
  const ctx: OpContext = {
    projectDir: projectDir as string,
    agent: 'mcp',
  };
  const result = (await handler(ctx, rest)) as OpResult | { ok: boolean };
  return {
    isError: result.ok === false,
    result,
  };
};

export const listOpTools = (): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> =>
  TOOL_CATALOG.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));

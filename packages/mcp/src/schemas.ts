// Hand-written JSON Schemas for each op, derived from @pixlland/engine-ops's
// catalog. Generated-by-tooling is future work (GDD §6.3 mentions
// ts-json-schema-generator); for now the maintenance cost is low (21 ops, mostly
// flat arg shapes) and hand-written keeps the dist clean.

export type JsonSchema = Record<string, unknown>;

const projectDirField: JsonSchema = {
  type: 'string',
  description: 'Absolute path to the project folder (containing project.pixlproject.json).',
};

const vec3: JsonSchema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 3,
  maxItems: 3,
};

const componentInstance: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    enabled: { type: 'boolean' },
    data: { type: 'object', additionalProperties: true },
  },
  required: ['type'],
  additionalProperties: false,
};

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export const TOOL_CATALOG: ToolDescriptor[] = [
  {
    name: 'project.create',
    description: 'Scaffold a brand-new PixlPlayground project folder (3D or 2D).',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        name: { type: 'string' },
        kind: { type: 'string', enum: ['2d', '3d'] },
        id: { type: 'string' },
        slug: { type: 'string' },
        refuseIfExists: { type: 'boolean', default: true },
      },
      required: ['projectDir', 'name', 'kind'],
    },
  },
  {
    name: 'project.validate',
    description: 'Re-run schema + 2D/3D coherence validation on disk.',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField },
      required: ['projectDir'],
    },
  },
  {
    name: 'project.pack',
    description: 'Bundle the project folder into a single .pixl archive.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        outPath: { type: 'string' },
        packedAt: { type: 'number' },
      },
      required: ['projectDir', 'outPath'],
    },
  },
  {
    name: 'project.unpack',
    description: 'Extract a .pixl archive into the project folder.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        sourcePath: { type: 'string' },
      },
      required: ['projectDir', 'sourcePath'],
    },
  },
  {
    name: 'scene.create',
    description: 'Add a new scene to the project document.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        name: { type: 'string' },
        kind: { type: 'string', enum: ['2d', '3d', 'hybrid'] },
        id: { type: 'string' },
        activate: { type: 'boolean' },
      },
      required: ['projectDir', 'name', 'kind'],
    },
  },
  {
    name: 'scene.delete',
    description: 'Remove a scene (refuses active/last).',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, sceneId: { type: 'string' } },
      required: ['projectDir', 'sceneId'],
    },
  },
  {
    name: 'scene.setActive',
    description: 'Set the active scene.',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, sceneId: { type: 'string' } },
      required: ['projectDir', 'sceneId'],
    },
  },
  {
    name: 'object.add',
    description: 'Append a new PixlSceneObject to a scene.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        sceneId: { type: 'string' },
        parentId: { type: ['string', 'null'] },
        type: { type: 'string' },
        name: { type: 'string' },
        id: { type: 'string' },
        visible: { type: 'boolean' },
        locked: { type: 'boolean' },
        transform: {
          type: 'object',
          properties: { position: vec3, rotation: vec3, scale: vec3 },
        },
        components: { type: 'array', items: componentInstance },
        tags: { type: 'array', items: { type: 'string' } },
        data: { type: 'object', additionalProperties: true },
      },
      required: ['projectDir', 'sceneId', 'parentId', 'type'],
    },
  },
  {
    name: 'object.update',
    description: 'Patch high-level object fields (name/visible/locked/tags/data).',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        sceneId: { type: 'string' },
        objectId: { type: 'string' },
        name: { type: 'string' },
        visible: { type: 'boolean' },
        locked: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        data: { type: 'object', additionalProperties: true },
      },
      required: ['projectDir', 'sceneId', 'objectId'],
    },
  },
  {
    name: 'object.remove',
    description: 'Remove an object and all its descendants.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        sceneId: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['projectDir', 'sceneId', 'objectId'],
    },
  },
  {
    name: 'object.reparent',
    description: 'Move an object to a new parent (newParentId=null for root).',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        sceneId: { type: 'string' },
        objectId: { type: 'string' },
        newParentId: { type: ['string', 'null'] },
      },
      required: ['projectDir', 'sceneId', 'objectId', 'newParentId'],
    },
  },
  {
    name: 'object.setTransform',
    description: 'Replace position/rotation/scale on an object.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        sceneId: { type: 'string' },
        objectId: { type: 'string' },
        position: vec3,
        rotation: vec3,
        scale: vec3,
      },
      required: ['projectDir', 'sceneId', 'objectId'],
    },
  },
  {
    name: 'object.setComponent',
    description: 'Add/update/remove a component on an object (data=null removes).',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        sceneId: { type: 'string' },
        objectId: { type: 'string' },
        componentId: { type: 'string' },
        type: { type: 'string' },
        enabled: { type: 'boolean' },
        data: { type: ['object', 'null'], additionalProperties: true },
      },
      required: ['projectDir', 'sceneId', 'objectId'],
    },
  },
  {
    name: 'asset.import',
    description: 'Register an asset entry in doc.assets.entries.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        name: { type: 'string' },
        kind: { type: 'string' },
        path: { type: 'string' },
        id: { type: 'string' },
        url: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        metadata: { type: 'object', additionalProperties: true },
      },
      required: ['projectDir', 'name', 'kind', 'path'],
    },
  },
  {
    name: 'asset.remove',
    description: 'Drop an asset entry by id.',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, assetId: { type: 'string' } },
      required: ['projectDir', 'assetId'],
    },
  },
  {
    name: 'script.read',
    description: 'Read a file from Scripts/.',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, path: { type: 'string' } },
      required: ['projectDir', 'path'],
    },
  },
  {
    name: 'script.write',
    description: 'Atomic write under Scripts/.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: projectDirField,
        path: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['projectDir', 'path', 'source'],
    },
  },
  {
    name: 'script.delete',
    description: 'Remove a file under Scripts/.',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, path: { type: 'string' } },
      required: ['projectDir', 'path'],
    },
  },
  {
    name: 'build.exportThree',
    description: 'STUB — three-web build (planned ADR-003 Phase 4).',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, outDir: { type: 'string' } },
      required: ['projectDir', 'outDir'],
    },
  },
  {
    name: 'build.exportPhaser',
    description: 'STUB — phaser-web build (planned GDD §6.5).',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, outDir: { type: 'string' } },
      required: ['projectDir', 'outDir'],
    },
  },
  {
    name: 'build.exportPixlland',
    description: 'STUB — pixlland portal export.',
    inputSchema: {
      type: 'object',
      properties: { projectDir: projectDirField, outDir: { type: 'string' } },
      required: ['projectDir', 'outDir'],
    },
  },
];

export const findTool = (name: string): ToolDescriptor | undefined =>
  TOOL_CATALOG.find((t) => t.name === name);

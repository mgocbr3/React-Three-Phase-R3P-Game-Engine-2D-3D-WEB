// Minimal mirror of engine/apps/studio/src/engine/project/schema.ts.
// Kept here standalone so the CLI does not depend on the studio React app.
// When the schema graduates to a shared package, replace this with an import.

export const PIXL_PROJECT_FORMAT = 'pixlplayground-project' as const;
export const PIXL_PROJECT_VERSION = 2 as const;

export const PIXL_3D_COMPONENT_TYPES = [
  'pixl.visual',
  'pixl.physics',
  'pixl.logic',
  'pixl.entity',
  'pixl.animation',
  'pixl.audio',
  'pixl.particles',
  'pixl.terrain',
  'pixl.mesh',
  'pixl.primitive',
  'pixl.transform3d',
  'pixl.light3d',
  'pixl.camera3d',
  'pixl.player',
] as const;

export const PIXL_2D_COMPONENT_TYPES = [
  'pixl.sprite',
  'pixl.transform2d',
  'pixl.physics2d',
  'pixl.tilemap',
  'pixl.animation2d',
  'pixl.camera2d',
] as const;

export const PIXL_SHARED_COMPONENT_TYPES = [
  'pixl.script',
  'pixl.audio',
  'pixl.ui',
  'pixl.tag',
] as const;

export type PixlSceneKind = '2d' | '3d' | 'hybrid';
export type PixlRuntimeKind = 'phaser-2d' | 'three-3d' | 'hybrid';

export interface PixlSceneObjectShape {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  transform?: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  };
  visible?: boolean;
  locked?: boolean;
  tags?: string[];
  components?: Array<{ id: string; type: string; enabled: boolean; data: Record<string, unknown> }>;
  data?: Record<string, unknown>;
}

export interface PixlSceneShape {
  id: string;
  name: string;
  kind: '2d' | '3d' | 'hybrid';
  rootObjects: PixlSceneObjectShape[];
  camera?: {
    id?: string;
    name?: string;
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
  };
  environment?: Record<string, unknown>;
  physics?: { engine?: string; gravity?: number[] };
  metadata?: Record<string, unknown>;
}

export interface PixlProjectShape {
  format: typeof PIXL_PROJECT_FORMAT;
  version: number;
  id: string;
  slug?: string;
  name: string;
  createdAt?: number;
  savedAt?: number;
  activeSceneId: string;
  scenes: PixlSceneShape[];
  assets?: {
    root?: string;
    folders?: string[];
    entries?: Array<{
      id: string;
      name: string;
      kind: string;
      path: string;
      url?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }>;
  };
  engine?: {
    name?: string;
    version?: string;
    schemaVersion?: number;
    runtimeManifest?: {
      runtime: PixlRuntimeKind;
      dependencies: Record<string, string>;
    };
  };
  runtime?: {
    primary?: PixlRuntimeKind;
    renderers?: string[];
    physics?: string[];
  };
  editor?: Record<string, unknown>;
  game?: { templateId?: string | null; script?: string };
}

export interface EngineVersionsManifest {
  manifestVersion: number;
  engine: { name: string; version: string };
  schemaVersion: number;
  runtimes: Record<string, { description?: string; dependencies: Record<string, string> }>;
  ui?: { description?: string; dependencies: Record<string, string> };
}

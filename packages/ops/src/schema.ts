// Mirror of engine/packages/cli/src/schema.ts.
//
// Kept here standalone so engine-ops does not depend on engine-cli (Phase 2 will
// be the reverse — CLI delegates to Ops). When the schema graduates to a shared
// package (likely engine-core), replace both copies with an import.

export const PIXL_PROJECT_FORMAT = 'pixlplayground-project' as const;
export const PIXL_PROJECT_VERSION = 2 as const;
export const PIXL_PROJECT_DOCUMENT_FILENAME = 'project.pixlproject.json' as const;

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

export type PixlVec3 = [number, number, number];

export interface PixlComponentInstance {
  id: string;
  type: string;
  enabled: boolean;
  data: Record<string, unknown>;
}

export interface PixlSceneObjectShape {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  transform?: {
    position?: PixlVec3;
    rotation?: PixlVec3;
    scale?: PixlVec3;
  };
  visible?: boolean;
  locked?: boolean;
  tags?: string[];
  components?: PixlComponentInstance[];
  data?: Record<string, unknown>;
  children?: PixlSceneObjectShape[];
}

export interface PixlSceneShape {
  id: string;
  name: string;
  kind: PixlSceneKind;
  rootObjects: PixlSceneObjectShape[];
  camera?: {
    id?: string;
    name?: string;
    position?: PixlVec3;
    target?: PixlVec3;
    fov?: number;
    near?: number;
    far?: number;
  };
  environment?: Record<string, unknown>;
  physics?: { engine?: string; gravity?: number[] };
  metadata?: Record<string, unknown>;
}

export interface PixlAssetEntryShape {
  id: string;
  name: string;
  kind: string;
  path: string;
  url?: string;
  tags?: string[];
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
    entries?: PixlAssetEntryShape[];
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

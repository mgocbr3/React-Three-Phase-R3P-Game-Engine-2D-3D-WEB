export const PIXL_PROJECT_FORMAT = 'pixlplayground-project' as const;
export const PIXL_PROJECT_VERSION = 2 as const;

export type PixlProjectFormat = typeof PIXL_PROJECT_FORMAT;
export type PixlProjectVersion = typeof PIXL_PROJECT_VERSION;

export type PixlRuntimeKind = 'phaser-2d' | 'three-3d' | 'hybrid';
export type PixlRendererKind = 'phaser' | 'three';
export type PixlPhysicsKind = 'arcade' | 'matter' | 'rapier' | 'none';
export type PixlSceneKind = '2d' | '3d' | 'hybrid';
export type PixlAssetKind =
  | 'model'
  | 'texture'
  | 'image'
  | 'spritesheet'
  | 'audio'
  | 'script'
  | 'sprite'
  | 'tilemap'
  | 'material'
  | 'prefab'
  | 'scene'
  | 'folder';

export type PixlVec2 = [number, number];
export type PixlVec3 = [number, number, number];

export interface PixlTransform {
  position: PixlVec3;
  rotation: PixlVec3;
  scale: PixlVec3;
}

export interface PixlTransform2D {
  position: PixlVec2;
  rotation: number;
  scale: PixlVec2;
}

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

export type Pixl3DComponentType = typeof PIXL_3D_COMPONENT_TYPES[number];
export type Pixl2DComponentType = typeof PIXL_2D_COMPONENT_TYPES[number];
export type PixlSharedComponentType = typeof PIXL_SHARED_COMPONENT_TYPES[number];

export interface PixlSpriteComponentData {
  textureId: string;
  centered?: boolean;
  flipH?: boolean;
  flipV?: boolean;
  hframes?: number;
  vframes?: number;
  frame?: number;
  tint?: string;
}

export interface PixlPhysics2DComponentData {
  engine: 'arcade' | 'matter';
  bodyType: 'dynamic' | 'static' | 'kinematic';
  velocity?: PixlVec2;
  angularVelocity?: number;
  mass?: number;
  gravityScale?: number;
  friction?: number;
  restitution?: number;
  isSensor?: boolean;
}

export interface PixlTileMapComponentData {
  tilesetId: string;
  tileWidth: number;
  tileHeight: number;
  layers: Array<{
    id: string;
    zIndex: number;
    data: number[][];
  }>;
}

export interface PixlAnimation2DComponentData {
  clips: Array<{
    name: string;
    frames: number[];
    frameDuration: number;
    loop: boolean;
  }>;
  defaultClip?: string;
  playing?: boolean;
}

export interface PixlCamera2DComponentData {
  zoom: number;
  followTargetId?: string | null;
  smoothing?: boolean;
  smoothFactor?: number;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface PixlComponentInstance {
  id: string;
  type: string;
  enabled: boolean;
  data: Record<string, unknown>;
}

export interface PixlSceneObject {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  transform: PixlTransform;
  visible: boolean;
  locked: boolean;
  tags: string[];
  components: PixlComponentInstance[];
  children?: PixlSceneObject[];
  data?: Record<string, unknown>;
}

export interface PixlSceneCamera {
  id: string;
  name: string;
  position: PixlVec3;
  target: PixlVec3;
  fov: number;
  near: number;
  far: number;
}

export interface PixlSceneEnvironment {
  background: string;
  ambientLight: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
}

export interface PixlScenePhysics {
  engine: PixlPhysicsKind;
  gravity: PixlVec3;
}

export interface PixlSceneDocument {
  id: string;
  name: string;
  kind: PixlSceneKind;
  units: 'pixels' | 'meters';
  rootObjects: PixlSceneObject[];
  camera: PixlSceneCamera;
  environment: PixlSceneEnvironment;
  physics: PixlScenePhysics;
  metadata?: Record<string, unknown>;
}

export interface PixlAssetEntry {
  id: string;
  name: string;
  kind: PixlAssetKind;
  path: string;
  url?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface PixlAssetManifest {
  root: string;
  folders: string[];
  entries: PixlAssetEntry[];
}

export interface PixlEditorState {
  mode: PixlSceneKind;
  transformSpace: string;
  snapEnabled: boolean;
  snapTranslate: number;
  snapRotate: number;
  snapScale: number;
  selectedSceneId: string;
  layoutPreset?: string;
}

export interface PixlProjectSettings {
  defaultWidth: number;
  defaultHeight: number;
  targetPlatform: 'web' | 'desktop' | 'mobile' | 'pixlland';
}

export interface PixlRuntimeSettings {
  primary: PixlRuntimeKind;
  renderers: PixlRendererKind[];
  physics: PixlPhysicsKind[];
}

export interface PixlProjectDocument {
  format: PixlProjectFormat;
  version: PixlProjectVersion;
  id: string;
  slug: string;
  name: string;
  createdAt: number;
  savedAt: number;
  engine: {
    name: 'PixlPlayground';
    version: string;
    schemaVersion: PixlProjectVersion;
    runtimeManifest?: {
      runtime: PixlRuntimeKind;
      dependencies: Record<string, string>;
    };
  };
  runtime: PixlRuntimeSettings;
  activeSceneId: string;
  scenes: PixlSceneDocument[];
  assets: PixlAssetManifest;
  editor: PixlEditorState;
  game: {
    /**
     * @deprecated The Lovable starter templates (adventure, fps-horror, ...)
     * were removed; the editor no longer branches on this value. Older
     * project files may still carry it, so the field is kept on the schema
     * for read-side retrocompat but new writes always emit null.
     */
    templateId: string | null;
    script: string;
    source?: Record<string, unknown>;
  };
  integrations?: Record<string, unknown>;
}

export interface LegacyPixlProjectDocument {
  format: PixlProjectFormat;
  version: 1;
  id: string;
  name: string;
  savedAt: number;
  currentTemplateId: string | null;
  gameScript: string;
  transformSpace: string;
  snapEnabled: boolean;
  snapTranslate: number;
  snapRotate: number;
  snapScale: number;
  objects: unknown[];
  assets: {
    folders: string[];
  };
}

export type AnyPixlProjectDocument = PixlProjectDocument | LegacyPixlProjectDocument;

export const DEFAULT_PROJECT_FOLDERS = [
  'Assets/3D_Models',
  'Assets/Sprites',
  'Assets/Tilemaps',
  'Assets/Textures',
  'Assets/Audio',
  'Assets/VFX',
  'Assets/Materials',
  'Assets/Prefabs',
  'Scenes',
  'Scripts',
  'ProjectSettings',
  'Builds',
  'Dev',
];

export const createPixlId = (prefix: string) => (
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
);

export const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const isPixlProjectDocument = (value: unknown): value is PixlProjectDocument => {
  const doc = value as Partial<PixlProjectDocument> | null;
  return Boolean(
    doc &&
    doc.format === PIXL_PROJECT_FORMAT &&
    doc.version === PIXL_PROJECT_VERSION &&
    Array.isArray(doc.scenes) &&
    typeof doc.activeSceneId === 'string'
  );
};

export const isLegacyPixlProjectDocument = (value: unknown): value is LegacyPixlProjectDocument => {
  const doc = value as Partial<LegacyPixlProjectDocument> | null;
  return Boolean(
    doc &&
    doc.format === PIXL_PROJECT_FORMAT &&
    doc.version === 1 &&
    Array.isArray(doc.objects)
  );
};

import type {
  PixlComponentInstance,
  PixlSceneKind,
} from '@/engine/project/schema';

export type EngineComponentScope = '2d' | '3d' | 'shared';

export interface EngineComponentDefinition {
  type: string;
  label: string;
  description: string;
  scope: EngineComponentScope;
  defaultData: Record<string, unknown>;
}

export type ComponentDataScalar = string | number | boolean | null;

const COMPONENT_DEFINITIONS: EngineComponentDefinition[] = [
  {
    type: 'pixl.sprite',
    label: 'Sprite Renderer',
    description: 'Imagem ou spritesheet renderizada pelo runtime Phaser.',
    scope: '2d',
    defaultData: {
      textureId: '',
      centered: true,
      flipH: false,
      flipV: false,
      frame: 0,
      tint: '#ffffff',
    },
  },
  {
    type: 'pixl.transform2d',
    label: 'Transform 2D',
    description: 'Posicao, rotacao e escala no espaco de pixels.',
    scope: '2d',
    defaultData: {
      position: [0, 0],
      rotation: 0,
      scale: [1, 1],
    },
  },
  {
    type: 'pixl.physics2d',
    label: 'Physics 2D',
    description: 'Corpo fisico 2D para arcade/platformer/top-down.',
    scope: '2d',
    defaultData: {
      engine: 'arcade',
      bodyType: 'dynamic',
      velocity: [0, 0],
      gravityScale: 1,
      friction: 0.2,
      restitution: 0,
      isSensor: false,
    },
  },
  {
    type: 'pixl.tilemap',
    label: 'Tilemap',
    description: 'Mapa de tiles para cenarios 2D.',
    scope: '2d',
    defaultData: {
      tilesetId: '',
      tileWidth: 16,
      tileHeight: 16,
      layers: [],
    },
  },
  {
    type: 'pixl.animation2d',
    label: 'Animation 2D',
    description: 'Clipes frame-based para spritesheets.',
    scope: '2d',
    defaultData: {
      clips: [],
      defaultClip: '',
      playing: false,
    },
  },
  {
    type: 'pixl.camera2d',
    label: 'Camera 2D',
    description: 'Camera Phaser com zoom, follow e bounds.',
    scope: '2d',
    defaultData: {
      zoom: 1,
      followTargetId: null,
      smoothing: true,
      smoothFactor: 0.12,
    },
  },
  {
    type: 'pixl.transform3d',
    label: 'Transform 3D',
    description: 'Posicao, rotacao e escala em metros.',
    scope: '3d',
    defaultData: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  },
  {
    type: 'pixl.visual',
    label: 'Mesh Renderer',
    description: 'Material, textura e sombras para objetos Three.js.',
    scope: '3d',
    defaultData: {
      textureUrl: '',
      opacity: 1,
      metalness: 0,
      roughness: 0.5,
      emissiveIntensity: 0,
      wireframe: false,
      castShadow: true,
      receiveShadow: true,
    },
  },
  {
    type: 'pixl.mesh',
    label: 'Mesh Source',
    description: 'Referencia de modelo ou mesh carregada pelo runtime 3D.',
    scope: '3d',
    defaultData: {
      modelUrl: '',
      nodeName: '',
      castShadow: true,
      receiveShadow: true,
    },
  },
  {
    type: 'pixl.physics',
    label: 'Physics 3D',
    description: 'Corpo Rapier 3D e collider.',
    scope: '3d',
    defaultData: {
      bodyType: 'dynamic',
      colliderShape: 'box',
      mass: 1,
      restitution: 0.2,
      friction: 0.7,
      linearDamping: 0,
      angularDamping: 0,
      isSensor: false,
    },
  },
  {
    type: 'pixl.logic',
    label: 'Logic',
    description: 'Comportamentos simples, tags e dados customizados.',
    scope: '3d',
    defaultData: {
      tags: [],
      behavior: 'none',
      behaviorSpeed: 1,
      patrolDistance: 4,
      customData: {},
    },
  },
  {
    type: 'pixl.animation',
    label: 'Animation 3D',
    description: 'Playback de clipes GLTF/GLB.',
    scope: '3d',
    defaultData: {
      availableAnimations: [],
      autoPlay: false,
      loop: true,
      speed: 1,
      paused: false,
      currentTime: 0,
    },
  },
  {
    type: 'pixl.particles',
    label: 'Particles',
    description: 'Emissor de particulas do runtime 3D.',
    scope: '3d',
    defaultData: {
      enabled: true,
      preset: 'sparkles',
      count: 64,
      size: 0.2,
      lifetime: 1,
      emissionRate: 24,
      loop: true,
    },
  },
  {
    type: 'pixl.terrain',
    label: 'Terrain',
    description: 'Configuracao de terreno procedural.',
    scope: '3d',
    defaultData: {
      enabled: true,
      width: 64,
      depth: 64,
      height: 8,
      seed: 1,
    },
  },
  {
    type: 'pixl.light3d',
    label: 'Light 3D',
    description: 'Fonte de luz Three.js com sombra opcional.',
    scope: '3d',
    defaultData: {
      intensity: 1,
      distance: 25,
      castShadow: true,
      helperVisible: true,
    },
  },
  {
    type: 'pixl.camera3d',
    label: 'Camera 3D',
    description: 'Camera perspectica do runtime Three.js.',
    scope: '3d',
    defaultData: {
      fov: 50,
      near: 0.1,
      far: 1000,
      mode: 'orbit',
    },
  },
  {
    type: 'pixl.player',
    label: 'Player Controller',
    description: 'Marcador de controle do jogador no runtime.',
    scope: '3d',
    defaultData: {
      movementMode: 'free',
      speed: 5,
      jumpForce: 8,
      maxHealth: 100,
    },
  },
  {
    type: 'pixl.entity',
    label: 'Entity',
    description: 'Entidade de gameplay com time, vida e AI.',
    scope: '3d',
    defaultData: {
      entityType: 'static',
      team: 'neutral',
      maxHealth: 100,
      currentHealth: 100,
      aiEnabled: false,
    },
  },
  {
    type: 'pixl.script',
    label: 'Script',
    description: 'Comportamento customizado serializado no projeto.',
    scope: 'shared',
    defaultData: {
      instances: [],
    },
  },
  {
    type: 'pixl.audio',
    label: 'Audio Source',
    description: 'Audio espacial ou 2D associado ao objeto.',
    scope: 'shared',
    defaultData: {
      url: '',
      volume: 1,
      loop: false,
      autoplay: false,
      distance: 20,
    },
  },
  {
    type: 'pixl.ui',
    label: 'UI Anchor',
    description: 'Marcador para HUD, menus e overlays DOM.',
    scope: 'shared',
    defaultData: {
      layer: 'hud',
      anchor: 'center',
      visible: true,
    },
  },
  {
    type: 'pixl.tag',
    label: 'Tags',
    description: 'Marcadores de gameplay e busca.',
    scope: 'shared',
    defaultData: {
      tags: [],
    },
  },
];

const cloneData = (value: Record<string, unknown>): Record<string, unknown> => (
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>
);

const slugComponentType = (type: string): string => type.replace(/^pixl\./, '').replace(/[^a-z0-9]+/gi, '-');

export const getComponentDefinition = (type: string): EngineComponentDefinition | undefined => (
  COMPONENT_DEFINITIONS.find((definition) => definition.type === type)
);

export const isComponentAllowedForScene = (type: string, sceneKind: PixlSceneKind): boolean => {
  const definition = getComponentDefinition(type);
  if (!definition) return false;
  if (definition.scope === 'shared') return true;
  if (sceneKind === '2d') return definition.scope === '2d';
  if (sceneKind === '3d') return definition.scope === '3d';
  return true;
};

export const getComponentDefinitionsForScene = (sceneKind: PixlSceneKind): EngineComponentDefinition[] => (
  COMPONENT_DEFINITIONS.filter((definition) => isComponentAllowedForScene(definition.type, sceneKind))
);

export const createComponentInstance = (
  objectId: string,
  type: string,
): PixlComponentInstance => {
  const definition = getComponentDefinition(type);
  if (!definition) {
    throw new Error(`Unknown component type: ${type}`);
  }

  return {
    id: `${objectId}-${slugComponentType(type)}`,
    type,
    enabled: true,
    data: cloneData(definition.defaultData),
  };
};

export const isEditableComponentDataValue = (value: unknown): value is ComponentDataScalar => (
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'
);

export const updateComponentDataField = (
  component: PixlComponentInstance,
  key: string,
  value: ComponentDataScalar,
): PixlComponentInstance => ({
  ...component,
  data: {
    ...(component.data ?? {}),
    [key]: value,
  },
});

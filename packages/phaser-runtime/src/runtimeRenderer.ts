import type { ComponentJSON, GameObjectJSON, SceneJSON } from './types.js';

type PhaserModule = typeof import('phaser');
type PhaserScene = import('phaser').Scene;
type PhaserGameObject = import('phaser').GameObjects.GameObject;

export interface RuntimeSceneContext {
  project?: unknown;
  phaserScene: SceneJSON;
  phaserModule: PhaserModule;
  assetBaseUrl: string;
}

const parseColor = (value: unknown, fallback = 0xffffff): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.startsWith('#')) return parseInt(value.slice(1), 16);
    if (/^0x[0-9a-f]+$/i.test(value)) return Number.parseInt(value.slice(2), 16);
  }
  return fallback;
};

const resolveAssetUrl = (assetBaseUrl: string, path: string): string => {
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  return `${assetBaseUrl.replace(/\/$/, '')}/${path}`;
};

const walkObjects = (
  list: GameObjectJSON[],
  fn: (obj: GameObjectJSON) => void,
): void => {
  for (const obj of list) {
    fn(obj);
    if (obj.children?.length) walkObjects(obj.children, fn);
  }
};

const findComponent = (obj: GameObjectJSON, type: string): ComponentJSON | undefined =>
  obj.components?.find((component) => component.type === type && component.enabled !== false);

const objectData = (obj: GameObjectJSON): Record<string, unknown> => obj.data ?? {};

const spriteAsset = (
  obj: GameObjectJSON,
): {
  key?: string;
  url?: string;
  frame?: string | number;
  frameWidth?: number;
  frameHeight?: number;
  frameMargin?: number;
  frameSpacing?: number;
} => {
  const data = objectData(obj);
  const sprite = findComponent(obj, 'pixl.sprite');
  const url = (sprite?.texturePath ?? data.imageUrl ?? data.url) as string | undefined;
  const key = (sprite?.textureKey ?? url) as string | undefined;
  const frame = sprite?.frame ?? data.frame;
  return {
    key,
    url,
    frame: typeof frame === 'string' || typeof frame === 'number' ? frame : undefined,
    frameWidth: typeof data.frameWidth === 'number' ? data.frameWidth : undefined,
    frameHeight: typeof data.frameHeight === 'number' ? data.frameHeight : undefined,
    frameMargin: typeof data.frameMargin === 'number' ? data.frameMargin : undefined,
    frameSpacing: typeof data.frameSpacing === 'number' ? data.frameSpacing : undefined,
  };
};

export const queueSceneAssetLoads = (
  scene: PhaserScene,
  rootObjects: GameObjectJSON[],
  assetBaseUrl: string,
): void => {
  const queued = new Set<string>();
  walkObjects(rootObjects, (obj) => {
    if (obj.type !== 'sprite' && obj.type !== 'image') return;
    const asset = spriteAsset(obj);
    if (!asset.key || !asset.url || queued.has(asset.key)) return;
    queued.add(asset.key);
    const fullUrl = resolveAssetUrl(assetBaseUrl, asset.url);
    if (asset.frameWidth && asset.frameHeight) {
      scene.load.spritesheet(asset.key, fullUrl, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
        margin: asset.frameMargin ?? 0,
        spacing: asset.frameSpacing ?? 0,
      });
    } else {
      scene.load.image(asset.key, fullUrl);
    }
  });
};

const stampPixlId = (go: PhaserGameObject, obj: GameObjectJSON): void => {
  const target = go as PhaserGameObject & {
    setName?: (name: string) => void;
    setData?: (key: string, value: unknown) => void;
  };
  target.setName?.(obj.name || obj.id);
  target.setData?.('pixlId', obj.id);
};

const applyCommonDisplayProps = (go: PhaserGameObject, obj: GameObjectJSON): void => {
  const data = objectData(obj);
  const target = go as PhaserGameObject & {
    setRotation?: (value: number) => void;
    setScale?: (x: number, y?: number) => void;
    setVisible?: (value: boolean) => void;
    setAlpha?: (value: number) => void;
    setDepth?: (value: number) => void;
    setTint?: (value: number) => void;
    setFlipX?: (value: boolean) => void;
    setFlipY?: (value: boolean) => void;
    displayWidth?: number;
    displayHeight?: number;
  };
  target.setRotation?.(obj.transform.rotation);
  target.setScale?.(obj.transform.scale.x, obj.transform.scale.y);
  target.setVisible?.(obj.visible !== false);
  if (typeof data.alpha === 'number') target.setAlpha?.(data.alpha);
  if (typeof data.depth === 'number') target.setDepth?.(data.depth);
  if (typeof data.tint === 'string' || typeof data.tint === 'number') {
    target.setTint?.(parseColor(data.tint, 0xffffff));
  }
  if (typeof data.flipX === 'boolean') target.setFlipX?.(data.flipX);
  if (typeof data.flipY === 'boolean') target.setFlipY?.(data.flipY);
  if (typeof data.displayWidth === 'number') target.displayWidth = data.displayWidth;
  if (typeof data.displayHeight === 'number') target.displayHeight = data.displayHeight;
};

const applyPhysics = (scene: PhaserScene, go: PhaserGameObject, obj: GameObjectJSON): void => {
  const physics = findComponent(obj, 'pixl.physics2d');
  if (!physics || !scene.physics?.add) return;
  const bodyKind = physics.body;
  const isStatic = bodyKind === 'static';
  try {
    scene.physics.add.existing(go, isStatic);
    const body = (go as PhaserGameObject & { body?: unknown }).body as
      | {
          setImmovable?: (value: boolean) => void;
          setAllowGravity?: (value: boolean) => void;
          setCircle?: (radius: number) => void;
          setSize?: (width: number, height: number) => void;
        }
      | undefined;
    if (!body) return;
    body.setImmovable?.(isStatic);
    body.setAllowGravity?.(bodyKind !== 'static');
    const size = physics.size as { x?: number; y?: number } | undefined;
    if (physics.shape === 'circle' && typeof size?.x === 'number') {
      body.setCircle?.(size.x);
    } else if (size && typeof size.x === 'number' && typeof size.y === 'number') {
      body.setSize?.(size.x, size.y);
    }
  } catch {
    // Some Phaser objects cannot receive Arcade bodies. Leave them visual.
  }
};

const applyAnimation = (scene: PhaserScene, go: PhaserGameObject, obj: GameObjectJSON): void => {
  const animation = findComponent(obj, 'pixl.animation2d');
  if (!animation) return;
  const key = animation.animationKey;
  const frames = animation.frames;
  const target = go as PhaserGameObject & { play?: (key: string) => void };
  if (typeof key !== 'string' || !Array.isArray(frames) || !target.play) return;
  if (!scene.anims.exists(key)) {
    scene.anims.create({
      key,
      frames: frames as Array<{ key: string; frame?: string | number; duration?: number }>,
      frameRate: typeof animation.frameRate === 'number' ? animation.frameRate : 12,
      repeat: typeof animation.repeat === 'number' ? animation.repeat : 0,
      yoyo: animation.yoyo === true,
    });
  }
  target.play(key);
};

const addMissingTextureMarker = (
  scene: PhaserScene,
  obj: GameObjectJSON,
  label: string,
): PhaserGameObject => {
  const { position } = obj.transform;
  const marker = scene.add.rectangle(position.x, position.y, 32, 32, 0xff00ff);
  marker.setStrokeStyle(2, 0xffffff);
  marker.setName(`${obj.name}(missing:${label})`);
  return marker;
};

const renderObject = (
  scene: PhaserScene,
  obj: GameObjectJSON,
  gameObjects: Map<string, PhaserGameObject>,
): void => {
  const data = objectData(obj);
  const { position } = obj.transform;
  let rendered: PhaserGameObject;
  let scaleMultiplier = 1;

  switch (obj.type) {
    case 'rectangle': {
      const width = typeof data.width === 'number' ? data.width : 40;
      const height = typeof data.height === 'number' ? data.height : 40;
      rendered = scene.add.rectangle(position.x, position.y, width, height, parseColor(data.color, 0xff00ff));
      break;
    }
    case 'circle': {
      const radius = typeof data.radius === 'number' ? data.radius : 20;
      rendered = scene.add.circle(position.x, position.y, radius, parseColor(data.color, 0xff00ff));
      break;
    }
    case 'sprite':
    case 'image': {
      const asset = spriteAsset(obj);
      if (!asset.key || !scene.textures.exists(asset.key)) {
        rendered = addMissingTextureMarker(scene, obj, asset.key ?? 'no-texture');
        break;
      }
      rendered = scene.add.sprite(position.x, position.y, asset.key, asset.frame);
      scaleMultiplier = typeof data.scale === 'number' ? data.scale : 1;
      break;
    }
    case 'text': {
      const text = typeof data.text === 'string' ? data.text : '';
      rendered = scene.add.text(position.x, position.y, text, {
        fontSize: typeof data.fontSize === 'number' ? `${data.fontSize}px` : '16px',
        fontFamily: typeof data.fontFamily === 'string' ? data.fontFamily : 'monospace',
        color: typeof data.color === 'string' ? data.color : '#ffffff',
      });
      break;
    }
    default:
      rendered = scene.add.rectangle(position.x, position.y, 20, 20, 0xff00ff);
      (rendered as PhaserGameObject & { setStrokeStyle?: (width: number, color: number) => void })
        .setStrokeStyle?.(2, 0xffffff);
      rendered.setName(`${obj.name}(unsupported:${obj.type})`);
      break;
  }

  stampPixlId(rendered, obj);
  applyCommonDisplayProps(rendered, obj);
  if (scaleMultiplier !== 1) {
    (rendered as PhaserGameObject & { setScale?: (x: number, y?: number) => void }).setScale?.(
      obj.transform.scale.x * scaleMultiplier,
      obj.transform.scale.y * scaleMultiplier,
    );
  }
  applyPhysics(scene, rendered, obj);
  applyAnimation(scene, rendered, obj);
  gameObjects.set(obj.id, rendered);
  if (obj.name) gameObjects.set(obj.name, rendered);

  for (const child of obj.children ?? []) {
    renderObject(scene, child, gameObjects);
  }
};

export const renderSceneObjects = (
  scene: PhaserScene,
  rootObjects: GameObjectJSON[],
): Map<string, PhaserGameObject> => {
  const gameObjects = new Map<string, PhaserGameObject>();
  for (const obj of rootObjects) renderObject(scene, obj, gameObjects);
  return gameObjects;
};

export const loadRuntimeScript = async (
  scene: PhaserScene,
  gameObjects: Map<string, PhaserGameObject>,
  context: RuntimeSceneContext,
): Promise<((deltaMs: number, timeMs: number) => void) | null> => {
  const scriptPath = context.phaserScene.runtimeScript;
  if (!scriptPath) return null;

  const fullUrl = `${resolveAssetUrl(context.assetBaseUrl, scriptPath)}?t=${Date.now()}`;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`runtimeScript fetch ${response.status} ${response.statusText} for ${fullUrl}`);
  }
  const code = await response.text();
  const blob = new Blob([code], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const mod = (await import(/* @vite-ignore */ blobUrl)) as {
      default?: unknown;
      setup?: unknown;
    };
    const setup = (mod.default ?? mod.setup) as
      | ((ctx: Record<string, unknown>) => unknown)
      | undefined;
    if (typeof setup !== 'function') return null;

    const onGameInput = (
      event: string,
      handler: (...args: unknown[]) => void,
    ): (() => void) => {
      scene.input.on(event, handler);
      return () => scene.input.off(event, handler);
    };

    const result = setup({
      scene,
      gameObjects,
      Phaser: context.phaserModule,
      project: context.project,
      activeScene: context.phaserScene,
      onGameInput,
      isPlaying: () => true,
    });
    return typeof result === 'function'
      ? (result as (deltaMs: number, timeMs: number) => void)
      : null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

export const sceneBackgroundColor = (scene: SceneJSON, fallback = 0x101822): number =>
  parseColor(scene.environment?.background, fallback);

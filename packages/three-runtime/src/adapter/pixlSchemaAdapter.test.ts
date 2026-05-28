import { describe, expect, it } from 'vitest';

import {
  pixlProjectToWesGame,
  pixlSceneToWesScene,
  type PixlProjectDocument,
  type PixlSceneDocument,
  type PixlSceneObject,
} from './pixlSchemaAdapter.js';

const makeObject = (overrides: Partial<PixlSceneObject> = {}): PixlSceneObject => ({
  id: 'obj-1',
  name: 'Test',
  type: 'box',
  parentId: null,
  transform: {
    position: [1, 2, 3],
    rotation: [0.1, 0.2, 0.3],
    scale: [1, 1, 1],
  },
  visible: true,
  locked: false,
  tags: [],
  components: [],
  ...overrides,
});

const makeScene = (objects: PixlSceneObject[]): PixlSceneDocument => ({
  id: 'scene-1',
  name: 'Main',
  kind: '3d',
  rootObjects: objects,
  environment: { background: '#9fd5df' },
  physics: { gravity: [0, -9.81, 0] },
});

describe('pixlSceneToWesScene', () => {
  it('maps transform components 1:1', () => {
    const scene = makeScene([makeObject()]);
    const out = pixlSceneToWesScene(scene);
    expect(out.sky).toMatchObject({
      enabled: true,
      horizonColor: '#9fd5df',
      zenithColor: '#6ea8dc',
    });
    expect(out.gameObjects).toHaveLength(1);
    const obj = out.gameObjects![0];
    expect(obj.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(obj.rotation).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
    expect(obj.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(obj.type).toBe('box');
    expect(obj.name).toBe('Test');
  });

  it('reconstructs parent/child tree from flat parentId list', () => {
    const scene = makeScene([
      makeObject({ id: 'root', name: 'Root' }),
      makeObject({ id: 'child-1', name: 'Child 1', parentId: 'root' }),
      makeObject({ id: 'child-2', name: 'Child 2', parentId: 'root' }),
      makeObject({ id: 'grandchild', name: 'Grand', parentId: 'child-1' }),
    ]);
    const out = pixlSceneToWesScene(scene);
    expect(out.gameObjects).toHaveLength(1);
    const root = out.gameObjects![0];
    expect(root.name).toBe('Root');
    expect(root.children).toHaveLength(2);
    const child1 = root.children!.find((c) => c.name === 'Child 1');
    expect(child1?.children).toHaveLength(1);
    expect(child1?.children![0].name).toBe('Grand');
  });

  it('accepts Pixl documents that already store nested children', () => {
    const scene = makeScene([
      makeObject({
        id: 'root',
        name: 'Root',
        children: [
          makeObject({
            id: 'child',
            name: 'Nested Child',
            parentId: null,
          }),
        ],
      }),
    ]);

    const out = pixlSceneToWesScene(scene);

    expect(out.gameObjects).toHaveLength(1);
    expect(out.gameObjects![0].name).toBe('Root');
    expect(out.gameObjects![0].children?.[0].name).toBe('Nested Child');
  });

  it('translates pixl.mesh components to Wes model components', () => {
    const scene = makeScene([
      makeObject({
        components: [
          {
            id: 'comp-1',
            type: 'pixl.mesh',
            enabled: true,
            data: { modelUrl: '/models/tree.glb' },
          },
        ],
      }),
    ]);
    const out = pixlSceneToWesScene(scene);
    const obj = out.gameObjects![0];
    expect(obj.components).toEqual([
      expect.objectContaining({ type: 'model', assetPath: '/models/tree.glb' }),
    ]);
  });

  it('drops disabled components', () => {
    const scene = makeScene([
      makeObject({
        components: [
          { id: 'a', type: 'pixl.mesh', enabled: false, data: { modelUrl: '/x.glb' } },
          { id: 'b', type: 'pixl.mesh', enabled: true, data: { modelUrl: '/y.glb' } },
        ],
      }),
    ]);
    const out = pixlSceneToWesScene(scene);
    expect(out.gameObjects![0].components).toHaveLength(1);
    expect((out.gameObjects![0].components![0] as { assetPath: string }).assetPath).toBe('/y.glb');
  });

  it('carries object identity into userData for round-trip', () => {
    const scene = makeScene([makeObject({ id: 'preserve-me', locked: true })]);
    const out = pixlSceneToWesScene(scene);
    expect(out.gameObjects![0].userData).toEqual({
      pixlObjectId: 'preserve-me',
      pixlLocked: true,
      pixlVisible: true,
    });
  });

  it('synthesizes native primitive visuals for Pixl built-in object types', () => {
    const scene = makeScene([
      makeObject({
        id: 'station-1',
        name: 'Unload Station',
        type: 'ring',
        components: [
          {
            id: 'visual',
            type: 'pixl.visual',
            enabled: true,
            data: {
              opacity: 0.72,
              roughness: 0.8,
              emissiveIntensity: 0.35,
            },
          },
          {
            id: 'physics',
            type: 'pixl.physics',
            enabled: true,
            data: { bodyType: 'fixed', isSensor: true },
          },
        ],
        data: { editor: { color: '#d2a64f' } },
      }),
    ]);

    const out = pixlSceneToWesScene(scene);
    expect(out.gameObjects![0].components).toEqual([
      expect.objectContaining({
        type: 'primitive',
        shape: 'torus',
        color: '#d2a64f',
        opacity: 0.72,
      }),
      expect.objectContaining({ type: 'rigidBody' }),
    ]);
  });

  it('does not add a primitive fallback when a GLB node already renders the object', () => {
    const scene = makeScene([
      makeObject({
        type: 'mesh',
        components: [
          {
            id: 'logic',
            type: 'pixl.logic',
            enabled: true,
            data: {
              customData: {
                sourceAsset: 'assets/Farm.glb',
                sourceNodeName: 'Barn',
              },
            },
          },
          {
            id: 'anim',
            type: 'pixl.animation',
            enabled: true,
            data: { modelUrl: 'assets/Farm.glb' },
          },
        ],
      }),
    ]);

    const out = pixlSceneToWesScene(scene);
    expect(out.gameObjects![0].components).toEqual([
      expect.objectContaining({ type: 'gltfNode', nodeName: 'Barn' }),
    ]);
  });

  it('maps Pixl mannequin animation settings to the native animation component', () => {
    const scene = makeScene([
      makeObject({
        type: 'player',
        components: [
          {
            id: 'mesh',
            type: 'pixl.mesh',
            enabled: true,
            data: { modelUrl: '/models/manequin/mixamo/xbot.glb' },
          },
          {
            id: 'anim',
            type: 'pixl.animation',
            enabled: true,
            data: {
              modelUrl: '/models/manequin/mixamo/xbot.glb',
              currentAnimation: 'idle',
              autoPlay: true,
              loop: true,
              speed: 1,
            },
          },
        ],
      }),
    ]);

    const out = pixlSceneToWesScene(scene);

    expect(out.gameObjects![0].components).toEqual([
      expect.objectContaining({ type: 'model', assetPath: '/models/manequin/mixamo/xbot.glb' }),
      expect.objectContaining({
        type: 'animation',
        assetPath: '/models/manequin/mixamo/xbot.glb',
        clip: 'idle',
        autoPlay: true,
      }),
    ]);
  });
});

describe('pixlProjectToWesGame', () => {
  it('produces a GameJSON pointing at the active scene', () => {
    const project: PixlProjectDocument = {
      id: 'p',
      slug: 'p',
      name: 'P',
      activeSceneId: 'scene-2',
      scenes: [
        { id: 'scene-1', name: 'First', kind: '3d', rootObjects: [] },
        { id: 'scene-2', name: 'Second', kind: '3d', rootObjects: [] },
      ],
    };

    const result = pixlProjectToWesGame(project);
    expect(result.game.initialScene).toBe('Second');
    expect(Object.keys(result.scenesByPath)).toEqual([
      'Scenes/scene-1.pixlscene.json',
      'Scenes/scene-2.pixlscene.json',
    ]);
  });
});

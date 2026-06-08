import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { createSkyDome, createSkySun } from './Scene.js';
import Scene from './Scene.js';
import GameObject from './GameObject.js';
import KinematicCharacterController from './util/KinematicCharacterController.js';

describe('Scene sky dome', () => {
  it('creates a non-selectable camera-following procedural sky', () => {
    const sky = createSkyDome({ horizonColor: '#abcdef', radius: 2000 });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(4, 5, 6);

    expect(sky.name).toBe('Pixl Sky');
    expect(sky.userData.pixlSky).toBe(true);
    expect(sky.frustumCulled).toBe(false);
    expect((sky.material as THREE.ShaderMaterial).side).toBe(THREE.BackSide);

    sky.onBeforeRender({} as THREE.WebGLRenderer, {} as THREE.Scene, camera, sky.geometry, sky.material as THREE.Material, null);
    expect(sky.position.toArray()).toEqual([4, 5, 6]);
  });

  it('uses a configured equirectangular texture for skybox backgrounds', async () => {
    const texture = new THREE.Texture();
    const loadAsync = vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(texture);
    const scene = new Scene({ getGameObjectClass: () => null } as unknown as ConstructorParameters<typeof Scene>[0]);

    try {
      await scene.setBackground({
        background: '#123456',
        sky: { enabled: true, textureUrl: '/skybox/kloppenheim_05_puresky_4k.jpg' },
      });

      expect(loadAsync).toHaveBeenCalledWith('/skybox/kloppenheim_05_puresky_4k.jpg');
      expect(scene.threeJSScene.background).toBe(texture);
      expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping);
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(scene.threeJSScene.userData.pixlSkyboxTextureUrl).toBe('/skybox/kloppenheim_05_puresky_4k.jpg');
    } finally {
      loadAsync.mockRestore();
    }
  });

  it('adds a non-selectable sun disk over texture skyboxes', async () => {
    const texture = new THREE.Texture();
    const loadAsync = vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(texture);
    const scene = new Scene({ getGameObjectClass: () => null } as unknown as ConstructorParameters<typeof Scene>[0]);

    try {
      await scene.setBackground({
        sky: {
          enabled: true,
          textureUrl: '/skybox/kloppenheim_05_puresky_4k.jpg',
          sun: {
            enabled: true,
            color: '#fffaf0',
            position: { x: 0, y: 50, z: 0 },
          },
        },
      });

      const skySun = scene.threeJSScene.children.find((child) => child.userData.pixlSkySun);
      expect(skySun?.name).toBe('Pixl Sky Sun');
      expect(skySun?.frustumCulled).toBe(false);
      expect(skySun?.raycast({} as THREE.Raycaster, [])).toBeUndefined();
    } finally {
      loadAsync.mockRestore();
    }
  });

  it('creates a camera-following sky sun aligned to the authored light direction', () => {
    const skySun = createSkySun({ position: { x: 0, y: 50, z: 0 } });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    expect(skySun).not.toBeNull();
    skySun!.onBeforeRender({} as THREE.WebGLRenderer, {} as THREE.Scene, camera, new THREE.BufferGeometry(), new THREE.Material(), null);
    const projected = skySun!.position.clone().project(camera);
    expect(Number.isFinite(projected.x)).toBe(true);
    expect(Number.isFinite(projected.y)).toBe(true);
  });

  it('keeps the sky sun visible when the authored direction is outside the camera frustum', () => {
    const skySun = createSkySun({ position: { x: 0, y: 50, z: 50 } });
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    expect(skySun).not.toBeNull();
    skySun!.onBeforeRender({} as THREE.WebGLRenderer, {} as THREE.Scene, camera, new THREE.BufferGeometry(), new THREE.Material(), null);
    const projected = skySun!.position.clone().project(camera);
    expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.82);
    expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.78);
  });
});

describe('Scene game object factory', () => {
  const makeScene = (getGameObjectClass: (type: string) => (new (...args: never[]) => GameObject) | null) => {
    const game = { getGameObjectClass } as unknown as ConstructorParameters<typeof Scene>[0];
    return new Scene(game);
  };

  it('uses KinematicCharacterController for player objects by default', () => {
    const scene = makeScene(() => null);
    const gameObject = (scene as unknown as {
      _createGameObject: (parent: Scene, json: { type: string; name: string }) => GameObject;
    })._createGameObject(scene, { type: 'player', name: 'Player' });

    expect(gameObject).toBeInstanceOf(KinematicCharacterController);
  });

  it('prefers a registered class over the default player controller mapping', () => {
    const scene = makeScene(() => GameObject);
    const gameObject = (scene as unknown as {
      _createGameObject: (parent: Scene, json: { type: string; name: string }) => GameObject;
    })._createGameObject(scene, { type: 'player', name: 'Player' });

    expect(gameObject).toBeInstanceOf(GameObject);
    expect(gameObject).not.toBeInstanceOf(KinematicCharacterController);
  });

  it('detects whether a scene has dynamic rigid bodies', () => {
    const scene = makeScene(() => null);
    const create = (scene as unknown as {
      _createGameObject: (parent: Scene, json: { type: string; name: string; components?: Array<Record<string, unknown>> }) => GameObject;
    })._createGameObject.bind(scene, scene);

    create({
      type: 'box',
      name: 'Static Floor',
      components: [{ type: 'rigidBody', rigidBodyType: 'fixed' }],
    });
    expect(scene.hasDynamicRigidBodies()).toBe(false);

    create({
      type: 'box',
      name: 'Crate',
      components: [{ type: 'rigidBody', rigidBodyType: 'dynamic' }],
    });
    expect(scene.hasDynamicRigidBodies()).toBe(true);
  });
});

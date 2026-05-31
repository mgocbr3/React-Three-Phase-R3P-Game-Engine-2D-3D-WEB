import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { createSkyDome } from './Scene.js';
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
});

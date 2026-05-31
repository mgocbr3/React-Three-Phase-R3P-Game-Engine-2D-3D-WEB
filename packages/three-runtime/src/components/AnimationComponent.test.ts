import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import GLTFAsset from '../assets/GLTFAsset.js';
import AnimationComponent from './AnimationComponent.js';

const makeAsset = (...clips: THREE.AnimationClip[]): GLTFAsset => {
  const asset = new GLTFAsset({} as never, '/model.glb', {} as never);
  asset.setData({
    scene: new THREE.Group(),
    scenes: [],
    cameras: [],
    animations: clips,
    asset: { version: '2.0' },
    parser: {},
    userData: {},
  } as never);
  return asset;
};

describe('AnimationComponent', () => {
  it('starts the requested GLTF clip and advances it each frame', async () => {
    const root = new THREE.Group();
    const clip = new THREE.AnimationClip('idle', 1, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 2]),
    ]);
    const component = new AnimationComponent({
      threeJSGroup: root,
      getScene: () => ({
        game: {
          loadAsset: async () => makeAsset(clip),
        },
      }),
    } as never, {
      type: 'animation',
      assetPath: '/model.glb',
      clip: 'idle',
      autoPlay: true,
      loop: false,
    });

    await component.load();
    component.beforeRender({ deltaTimeInSec: 0.5 });

    expect(component.getCurrentClipName()).toBe('idle');
    expect(root.position.x).toBeGreaterThan(0.9);
    expect(root.position.x).toBeLessThan(1.1);
  });

  it('switches locomotion clips from controller state', async () => {
    const root = new THREE.Group();
    const idle = new THREE.AnimationClip('idle', 1, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 0]),
    ]);
    const run = new THREE.AnimationClip('run', 1, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 4]),
    ]);
    const component = new AnimationComponent({
      threeJSGroup: root,
      getScene: () => ({
        game: {
          loadAsset: async () => makeAsset(idle, run),
        },
      }),
    } as never, {
      type: 'animation',
      assetPath: '/model.glb',
      clip: 'idle',
      movementClips: { idle: 'idle', run: 'run' },
      crossFadeDuration: 0,
      autoPlay: true,
    });

    await component.load();
    root.userData.pixlLocomotionState = { moving: true, sprinting: true, grounded: true };
    component.beforeRender({ deltaTimeInSec: 0.1 });

    expect(component.getCurrentClipName()).toBe('run');
  });
});

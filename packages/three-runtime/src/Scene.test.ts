import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { createSkyDome } from './Scene.js';

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

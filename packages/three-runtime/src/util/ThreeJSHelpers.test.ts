import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { optimizeStaticObject3D } from './ThreeJSHelpers.js';

describe('optimizeStaticObject3D', () => {
  it('freezes static render nodes while keeping them cullable and raycastable', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
      ),
      new THREE.MeshBasicMaterial(),
    );
    mesh.position.set(2, 0, 0);
    root.add(mesh);

    optimizeStaticObject3D(root);

    expect(root.matrixAutoUpdate).toBe(false);
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.matrixWorldNeedsUpdate).toBe(true);
    expect(mesh.geometry.boundingSphere).not.toBeNull();
  });

  it('leaves skeletal animation nodes live', () => {
    const skinned = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    const bone = new THREE.Bone();
    skinned.add(bone);

    optimizeStaticObject3D(skinned);

    expect(skinned.matrixAutoUpdate).toBe(true);
    expect(bone.matrixAutoUpdate).toBe(true);
  });
});

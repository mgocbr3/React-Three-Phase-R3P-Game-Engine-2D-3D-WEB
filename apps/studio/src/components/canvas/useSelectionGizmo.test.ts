import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  enlargeTransformPickerHitArea,
  findTransformPickerHitAxis,
  rayHitsTransformHelper,
  resolveSelectableObject,
} from './useSelectionGizmo';

describe('resolveSelectableObject', () => {
  it('attaches native selection to the owning Pixl object instead of a child mesh', () => {
    const owner = new THREE.Group();
    owner.userData.pixlObjectId = 'station-05-flower-stall';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    owner.add(mesh);

    expect(resolveSelectableObject(mesh)).toBe(owner);
  });

  it('keeps non-Pixl objects selectable as-is', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    expect(resolveSelectableObject(mesh)).toBe(mesh);
  });

  it('detects transform helper hits before selecting objects behind it', () => {
    const helper = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    handle.position.set(0, 0, 0);
    helper.add(handle);
    helper.updateWorldMatrix(true, true);

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(0, 0, -1),
    );

    expect(rayHitsTransformHelper(raycaster, helper)).toBe(true);
  });

  it('enlarges the invisible transform picker hit area', () => {
    const picker = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    handle.name = 'X';
    picker.add(handle);
    picker.updateWorldMatrix(true, true);

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0.7, 0, 5),
      new THREE.Vector3(0, 0, -1),
    );

    expect(rayHitsTransformHelper(raycaster, picker)).toBe(false);
    expect(findTransformPickerHitAxis(raycaster, picker)).toBeNull();

    enlargeTransformPickerHitArea([picker], 1.65);

    expect(rayHitsTransformHelper(raycaster, picker)).toBe(true);
    expect(findTransformPickerHitAxis(raycaster, picker)).toBe('X');
  });

  it('does not block scene selection when the transform helper is detached', () => {
    const helper = new THREE.Group();
    helper.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    helper.updateWorldMatrix(true, true);

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(0, 0, -1),
    );

    expect(rayHitsTransformHelper(raycaster, helper, false)).toBe(false);
  });

  it('ignores invisible transform picker handles', () => {
    const helper = new THREE.Group();
    const hiddenHandle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    hiddenHandle.visible = false;
    helper.add(hiddenHandle);
    helper.updateWorldMatrix(true, true);

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(0, 0, -1),
    );

    expect(rayHitsTransformHelper(raycaster, helper)).toBe(false);
  });

  it('still accepts visible handles inside Three.js invisible picker roots', () => {
    const picker = new THREE.Group();
    picker.visible = false;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    handle.name = 'Y';
    picker.add(handle);
    picker.updateWorldMatrix(true, true);

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(0, 0, -1),
    );

    expect(rayHitsTransformHelper(raycaster, picker)).toBe(true);
    expect(findTransformPickerHitAxis(raycaster, picker)).toBe('Y');
  });
});

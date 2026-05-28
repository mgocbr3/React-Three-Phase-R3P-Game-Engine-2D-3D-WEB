import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  createThreeEditorSceneHelpers,
  getEditorObjectIdForNativeSelection,
  getThreeAddObjectPosition,
  getThreeSceneAxisView,
  getThreeEditorGridConfig,
  shouldEnableThreeEditorTools,
} from './ThreeRuntimeMount';

describe('ThreeRuntimeMount', () => {
  it('disables editor-only 3D controls while playing', () => {
    expect(shouldEnableThreeEditorTools({ visible: true, isRuntimePreview: true })).toBe(false);
    expect(shouldEnableThreeEditorTools({ visible: true, isRuntimePreview: false })).toBe(true);
    expect(shouldEnableThreeEditorTools({ visible: false, isRuntimePreview: false })).toBe(false);
  });

  it('maps native canvas selection back to the editor object id', () => {
    const object = new THREE.Object3D();
    object.userData.pixlObjectId = 'player-body';

    expect(getEditorObjectIdForNativeSelection(object)).toBe('player-body');
    expect(getEditorObjectIdForNativeSelection(null)).toBeNull();
  });

  it('creates non-selectable native scene helpers from editor settings', () => {
    expect(getThreeEditorGridConfig(1000)).toEqual({ size: 500, divisions: 200 });

    const helpers = createThreeEditorSceneHelpers({ showGrid: true, showAxes: true, gridSize: 80 });

    expect(helpers.userData.pixlEditorHelper).toBe(true);
    expect(helpers.children.map((child) => child.name)).toEqual(['Editor Grid', 'Editor Axes']);
    expect(helpers.children.every((child) => child.userData.pixlEditorHelper)).toBe(true);
  });

  it('snaps the native scene camera to Unity-like axis views', () => {
    expect(getThreeSceneAxisView('x', new THREE.Vector3(1, 2, 3), 10)).toEqual({
      position: [11, 2, 3],
      up: [0, 1, 0],
    });
    expect(getThreeSceneAxisView('y', new THREE.Vector3(1, 2, 3), 10)).toEqual({
      position: [1, 12, 3],
      up: [0, 0, -1],
    });
    expect(getThreeSceneAxisView('z', new THREE.Vector3(1, 2, 3), 10)).toEqual({
      position: [1, 2, 13],
      up: [0, 1, 0],
    });
  });

  it('creates 3D objects at the orbit pivot or in front of the scene camera', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 4, 10);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();

    expect(getThreeAddObjectPosition(new THREE.Vector3(2, 3, 4), camera)).toEqual([2, 3, 4]);

    const position = getThreeAddObjectPosition(null, camera, 7);
    expect(position).not.toBeUndefined();
    expect(position?.[1]).toBeCloseTo(1.99, 2);
    expect(position?.[2]).toBeCloseTo(3.30, 2);
  });
});

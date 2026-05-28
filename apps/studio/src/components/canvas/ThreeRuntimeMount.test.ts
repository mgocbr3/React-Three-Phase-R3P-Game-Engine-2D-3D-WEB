import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  createThreeEditorSceneHelpers,
  getEditorObjectIdForNativeSelection,
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
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  createThreeEditorSceneHelpers,
  createThreeNativePostProcessingOptions,
  getEditorObjectIdForNativeSelection,
  getThreeAddObjectPosition,
  getThreeCameraTarget,
  getThreeNativePixelRatio,
  getThreeNativePostProcessingEffects,
  getThreeSceneAxisView,
  getThreeSceneViewShortcut,
  getThreeTransformShortcutMode,
  getThreeEditorGridConfig,
  hasEditorObjectId,
  shouldEnableThreeEditorTools,
  shouldRunThreeEditorRenderLoop,
  shouldRunThreeRuntimeSimulation,
} from './ThreeRuntimeMount';

describe('ThreeRuntimeMount', () => {
  it('disables editor-only 3D controls while playing', () => {
    expect(shouldEnableThreeEditorTools({ visible: true, isRuntimePreview: true })).toBe(false);
    expect(shouldEnableThreeEditorTools({ visible: true, isRuntimePreview: false })).toBe(true);
    expect(shouldEnableThreeEditorTools({ visible: false, isRuntimePreview: false })).toBe(false);
  });

  it('separates 3D editor rendering from Play Mode simulation', () => {
    expect(shouldRunThreeRuntimeSimulation({ visible: true, isRuntimePreview: true, loadStatus: 'ready' })).toBe(true);
    expect(shouldRunThreeRuntimeSimulation({ visible: true, isRuntimePreview: false, loadStatus: 'ready' })).toBe(false);
    expect(shouldRunThreeRuntimeSimulation({ visible: true, isRuntimePreview: true, loadStatus: 'loading' })).toBe(false);

    expect(shouldRunThreeEditorRenderLoop({ visible: true, editorToolsEnabled: true, loadStatus: 'ready' })).toBe(true);
    expect(shouldRunThreeEditorRenderLoop({ visible: true, editorToolsEnabled: false, loadStatus: 'ready' })).toBe(false);
    expect(shouldRunThreeEditorRenderLoop({ visible: false, editorToolsEnabled: true, loadStatus: 'ready' })).toBe(false);
  });

  it('keeps native Three play mode direct by default', () => {
    const options = createThreeNativePostProcessingOptions({
      toneMapping: 'none',
      toneMappingExposure: 1,
      bloom: false,
      bloomIntensity: 0,
      bloomThreshold: 1,
      bloomRadius: 0,
      colorGrading: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      dpr: 1,
      maxDpr: 2,
    });

    expect(options).toMatchObject({
      enabled: false,
      toneMapping: 'none',
      bloom: false,
      colorGrading: false,
      contrast: 0,
      saturation: 0,
    });
    expect(getThreeNativePostProcessingEffects(options)).toBe('off');
  });

  it('keeps native Three play mode direct even when settings request effects', () => {
    const options = createThreeNativePostProcessingOptions({
      toneMapping: 'aces',
      toneMappingExposure: 1.1,
      bloom: true,
      bloomIntensity: 0.5,
      bloomThreshold: 0.85,
      bloomRadius: 0.45,
      colorGrading: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      dpr: 1,
      maxDpr: 2,
    });

    expect(options).toMatchObject({
      enabled: false,
      toneMapping: 'none',
      bloom: false,
      colorGrading: false,
      bloomIntensity: 0,
      bloomThreshold: 1,
      bloomRadius: 0,
    });
    expect(getThreeNativePostProcessingEffects(options)).toBe('off');
  });

  it('keeps the native 3D editor scene free of runtime post-processing', () => {
    const options = createThreeNativePostProcessingOptions({
      toneMapping: 'aces',
      toneMappingExposure: 1.3,
      bloom: true,
      bloomIntensity: 0.4,
      bloomThreshold: 0.85,
      bloomRadius: 0.4,
      colorGrading: true,
      brightness: 0.2,
      contrast: 0.2,
      saturation: 0.2,
      hue: 0.1,
      dpr: 1,
      maxDpr: 2,
    }, false);

    expect(options).toMatchObject({
      enabled: false,
      toneMapping: 'none',
      toneMappingExposure: 1,
      bloom: false,
      colorGrading: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
    });
  });

  it('caps native Three pixel ratio for the selected quality preset', () => {
    expect(getThreeNativePixelRatio({ dpr: 1.25, maxDpr: 2 }, 2)).toBe(2);
    expect(getThreeNativePixelRatio({ dpr: 0.5, maxDpr: 3 }, 2)).toBe(1);
  });

  it('maps native canvas selection back to the editor object id', () => {
    const object = new THREE.Object3D();
    object.userData.pixlObjectId = 'player-body';

    expect(getEditorObjectIdForNativeSelection(object)).toBe('player-body');
    object.userData.pixlObjectId = undefined;
    object.userData.gameObjectID = 'runtime-only-id';
    expect(getEditorObjectIdForNativeSelection(object)).toBeNull();
    expect(getEditorObjectIdForNativeSelection(null)).toBeNull();
  });

  it('keeps runtime-only Pixl ids from selecting missing editor objects', () => {
    expect(hasEditorObjectId([{ id: 'cube-1', name: 'Cube' }], 'cube-1')).toBe(true);
    expect(hasEditorObjectId([{ id: 'cube-1', name: 'Cube' }], 'farm-node-00004-ground-005-001')).toBe(false);
    expect(hasEditorObjectId([{ id: 'cube-1', name: 'Cube' }], null)).toBe(false);
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

  it('does not move the 3D Scene camera from number-key shortcuts', () => {
    expect(getThreeSceneViewShortcut({ code: 'Numpad1' })).toBeNull();
    expect(getThreeSceneViewShortcut({ code: 'Numpad3' })).toBeNull();
    expect(getThreeSceneViewShortcut({ code: 'Numpad7' })).toBeNull();
    expect(getThreeSceneViewShortcut({ code: 'Numpad5' })).toBeNull();
    expect(getThreeSceneViewShortcut({ code: 'Digit1' })).toBeNull();
    expect(getThreeSceneViewShortcut({ code: 'Digit7' })).toBeNull();
    expect(getThreeSceneViewShortcut({ code: 'Numpad7', metaKey: true })).toBeNull();
  });

  it('maps MainArea-like transform hotkeys in native 3D', () => {
    expect(getThreeTransformShortcutMode({ code: 'KeyR' })).toBe('rotate');
    expect(getThreeTransformShortcutMode({ code: 'KeyS' })).toBe('scale');
    expect(getThreeTransformShortcutMode({ code: 'KeyT' })).toBe('translate');
    expect(getThreeTransformShortcutMode({ code: 'KeyP' })).toBe('translate');
    expect(getThreeTransformShortcutMode({ code: 'KeyR', ctrlKey: true })).toBeNull();
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

  it('reads camera targets from Pixl array and object formats', () => {
    expect(getThreeCameraTarget([0, 1, -2])).toEqual({ x: 0, y: 1, z: -2 });
    expect(getThreeCameraTarget({ x: 3, y: 4, z: 5 })).toEqual({ x: 3, y: 4, z: 5 });
    expect(getThreeCameraTarget([0, Number.NaN, 2])).toEqual({ x: 0, y: 0, z: 2 });
  });
});

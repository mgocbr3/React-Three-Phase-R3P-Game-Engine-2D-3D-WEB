import { createElement, useMemo, useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import {
  enlargeTransformPickerHitArea,
  findTransformPickerHitAxis,
  getNativeGizmoSnapConfig,
  getNativeGizmoTransformSpace,
  getThreeObjectTransform,
  hasThreeObjectTransformChanged,
  isNativeEditorHelperObject,
  rayHitsTransformHelper,
  resolveSelectableObject,
  resolveSelectionFromRaycastHits,
  useSelectionGizmo,
} from './useSelectionGizmo';

const SelectionGizmoHarness = ({
  onSelectionFocus,
}: {
  onSelectionFocus: (object: THREE.Object3D) => void;
}) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const { camera, scene } = useMemo(() => {
    const nextScene = new THREE.Scene();
    const nextCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    nextCamera.position.set(0, 0, 5);
    nextCamera.lookAt(0, 0, 0);
    nextCamera.updateMatrixWorld(true);

    const owner = new THREE.Group();
    owner.userData.pixlObjectId = 'tree-01';
    owner.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    nextScene.add(owner);
    nextScene.updateMatrixWorld(true);

    return { camera: nextCamera, scene: nextScene };
  }, []);

  useSelectionGizmo({
    canvas,
    camera,
    scene,
    onSelectionFocus,
  });

  return createElement('canvas', {
    'data-testid': 'scene-canvas',
    ref: (node: HTMLCanvasElement | null) => {
      if (node) {
        node.getBoundingClientRect = () => ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 100,
          bottom: 100,
          width: 100,
          height: 100,
          toJSON: () => ({}),
        });
      }
      setCanvas(node);
    },
  });
};

describe('resolveSelectableObject', () => {
  it('attaches native selection to the owning Pixl object instead of a child mesh', () => {
    const owner = new THREE.Group();
    owner.userData.pixlObjectId = 'station-05-flower-stall';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    owner.add(mesh);

    expect(resolveSelectableObject(mesh)).toBe(owner);
  });

  it('ignores non-Pixl objects without runtime ids', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

    expect(resolveSelectableObject(mesh)).toBeNull();
  });

  it('never selects editor-only grid or axis helpers', () => {
    const helper = new THREE.Group();
    helper.userData.pixlEditorHelper = true;
    const child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    helper.add(child);

    expect(isNativeEditorHelperObject(child)).toBe(true);
    expect(resolveSelectableObject(child)).toBeNull();
  });

  it('uses the first runtime-resolved GameObject instead of the first raw Three hit', () => {
    const helperHit = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const owner = new THREE.Group();
    owner.userData.pixlObjectId = 'cube-01';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    owner.add(mesh);

    const hits = [
      { object: helperHit },
      { object: mesh },
    ] as unknown as THREE.Intersection[];

    expect(resolveSelectionFromRaycastHits(hits, null, (object) => (object === mesh ? owner : null))).toBe(owner);
  });

  it('prefers concrete selectable objects over broad fallback hits', () => {
    const ground = new THREE.Group();
    ground.userData.pixlObjectId = 'ground-1';
    const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10));
    ground.add(groundMesh);
    const player = new THREE.Group();
    player.userData.pixlObjectId = 'main-player';
    const playerMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    player.add(playerMesh);

    const hits = [
      { object: groundMesh },
      { object: playerMesh },
    ] as unknown as THREE.Intersection[];

    expect(resolveSelectionFromRaycastHits(
      hits,
      null,
      undefined,
      (object) => object.userData.pixlObjectId === 'main-player',
    )).toBe(player);
  });

  it('focuses native scene selection only on double click', () => {
    const onSelectionFocus = vi.fn();
    const { getByTestId } = render(createElement(SelectionGizmoHarness, { onSelectionFocus }));
    const canvas = getByTestId('scene-canvas');

    fireEvent.click(canvas, { button: 0, clientX: 50, clientY: 50 });
    expect(onSelectionFocus).not.toHaveBeenCalled();

    fireEvent.dblClick(canvas, { button: 0, clientX: 50, clientY: 50 });
    expect(onSelectionFocus).toHaveBeenCalledTimes(1);
    expect(onSelectionFocus.mock.calls[0]?.[0].userData.pixlObjectId).toBe('tree-01');
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

  it('serializes native gizmo transforms for the editor store', () => {
    const object = new THREE.Object3D();
    object.position.set(1, 2, 3);
    object.rotation.set(0.1, 0.2, 0.3);
    object.scale.set(2, 3, 4);

    expect(getThreeObjectTransform(object)).toEqual({
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: [2, 3, 4],
    });
    expect(hasThreeObjectTransformChanged(
      { position: [1, 2, 3], rotation: [0.1, 0.2, 0.3], scale: [2, 3, 4] },
      getThreeObjectTransform(object),
    )).toBe(false);
    object.position.x = 5;
    expect(hasThreeObjectTransformChanged(
      { position: [1, 2, 3], rotation: [0.1, 0.2, 0.3], scale: [2, 3, 4] },
      getThreeObjectTransform(object),
    )).toBe(true);
  });

  it('converts editor snap settings for native TransformControls', () => {
    expect(getNativeGizmoSnapConfig({
      snapEnabled: true,
      snapTranslate: 2,
      snapRotate: 45,
      snapScale: 0.5,
    })).toEqual({
      translation: 2,
      rotation: Math.PI / 4,
      scale: 0.5,
    });

    expect(getNativeGizmoSnapConfig({
      snapEnabled: false,
      snapTranslate: 2,
      snapRotate: 45,
      snapScale: 0.5,
    })).toEqual({
      translation: null,
      rotation: null,
      scale: null,
    });
  });

  it('normalizes editor transform space for native TransformControls', () => {
    expect(getNativeGizmoTransformSpace('local')).toBe('local');
    expect(getNativeGizmoTransformSpace('world')).toBe('world');
    expect(getNativeGizmoTransformSpace(undefined)).toBe('world');
  });
});

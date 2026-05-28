import { describe, expect, it } from 'vitest';

import {
  createComponentInstance,
  getComponentDefinitionsForScene,
  isEditableComponentDataValue,
  isComponentAllowedForScene,
  updateComponentDataField,
} from './componentCatalog';

describe('component catalog', () => {
  it('lists 2D components without exposing 3D-only components', () => {
    const types = getComponentDefinitionsForScene('2d').map((definition) => definition.type);

    expect(types).toContain('pixl.sprite');
    expect(types).toContain('pixl.physics2d');
    expect(types).toContain('pixl.script');
    expect(types).not.toContain('pixl.light3d');
    expect(types).not.toContain('pixl.physics');
  });

  it('lists 3D components without exposing 2D-only components', () => {
    const types = getComponentDefinitionsForScene('3d').map((definition) => definition.type);

    expect(types).toContain('pixl.visual');
    expect(types).toContain('pixl.primitive');
    expect(types).toContain('pixl.physics');
    expect(types).toContain('pixl.script');
    expect(types).not.toContain('pixl.sprite');
    expect(types).not.toContain('pixl.physics2d');
  });

  it('creates enabled component instances with cloned default data', () => {
    const first = createComponentInstance('hero', 'pixl.physics2d');
    const second = createComponentInstance('hero', 'pixl.physics2d');

    expect(first).toMatchObject({
      id: 'hero-physics2d',
      type: 'pixl.physics2d',
      enabled: true,
      data: {
        engine: 'arcade',
        bodyType: 'dynamic',
      },
    });
    expect(first.data).not.toBe(second.data);
  });

  it('rejects unknown component types and scene-mismatched types', () => {
    expect(() => createComponentInstance('hero', 'pixl.unknown')).toThrow('Unknown component type');
    expect(isComponentAllowedForScene('pixl.sprite', '3d')).toBe(false);
    expect(isComponentAllowedForScene('pixl.light3d', '2d')).toBe(false);
    expect(isComponentAllowedForScene('pixl.primitive', '3d')).toBe(true);
    expect(isComponentAllowedForScene('pixl.script', '2d')).toBe(true);
  });

  it('updates scalar component data fields immutably', () => {
    const component = createComponentInstance('hero', 'pixl.physics2d');
    const updated = updateComponentDataField(component, 'bodyType', 'static');

    expect(updated.data.bodyType).toBe('static');
    expect(component.data.bodyType).toBe('dynamic');
    expect(updated.data).not.toBe(component.data);
  });

  it('identifies scalar values editable by the inspector', () => {
    expect(isEditableComponentDataValue('hero')).toBe(true);
    expect(isEditableComponentDataValue(2)).toBe(true);
    expect(isEditableComponentDataValue(false)).toBe(true);
    expect(isEditableComponentDataValue(null)).toBe(true);
    expect(isEditableComponentDataValue([0, 0])).toBe(false);
    expect(isEditableComponentDataValue({ nested: true })).toBe(false);
  });
});

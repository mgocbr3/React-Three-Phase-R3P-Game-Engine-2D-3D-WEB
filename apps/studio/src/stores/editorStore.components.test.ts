import { beforeEach, describe, expect, it } from 'vitest';

import { createComponentInstance } from '@/services/componentCatalog';
import { useEditorStore, type SceneObject } from './editorStore';

const testObject: SceneObject = {
  id: 'hero',
  name: 'Hero',
  type: 'sprite',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#ffffff',
  visible: true,
  locked: false,
  components: [],
};

describe('editorStore component actions', () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeSceneKind: '2d',
      objects: [testObject],
      selectedObjectId: 'hero',
      history: [],
      historyIndex: -1,
    });
  });

  it('adds components to objects and records history', () => {
    const component = createComponentInstance('hero', 'pixl.physics2d');

    useEditorStore.getState().addComponentToObject('hero', component);

    const object = useEditorStore.getState().objects[0];
    expect(object.components).toEqual([component]);
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('does not add duplicate component types', () => {
    const component = createComponentInstance('hero', 'pixl.physics2d');

    useEditorStore.getState().addComponentToObject('hero', component);
    useEditorStore.getState().addComponentToObject('hero', {
      ...component,
      id: 'hero-physics2d-duplicate',
    });

    expect(useEditorStore.getState().objects[0].components).toHaveLength(1);
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('rejects components that do not match the active scene kind', () => {
    const component = createComponentInstance('hero', 'pixl.light3d');

    useEditorStore.getState().addComponentToObject('hero', component);

    expect(useEditorStore.getState().objects[0].components).toEqual([]);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });

  it('updates component enabled state and data', () => {
    const component = createComponentInstance('hero', 'pixl.physics2d');
    useEditorStore.setState({
      objects: [{ ...testObject, components: [component] }],
      history: [],
      historyIndex: -1,
    });

    useEditorStore.getState().updateObjectComponent('hero', component.id, { enabled: false });
    useEditorStore.getState().updateObjectComponentData('hero', component.id, {
      ...component.data,
      bodyType: 'static',
    });

    const updated = useEditorStore.getState().objects[0].components?.[0];
    expect(updated).toMatchObject({
      enabled: false,
      data: {
        bodyType: 'static',
      },
    });
  });

  it('leaves missing component updates as no-ops', () => {
    const before = useEditorStore.getState().objects[0];

    useEditorStore.getState().updateObjectComponent('hero', 'missing-component', { enabled: false });

    expect(useEditorStore.getState().objects[0]).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });

  it('removes components from objects and records history', () => {
    const component = createComponentInstance('hero', 'pixl.physics2d');
    useEditorStore.setState({
      objects: [{ ...testObject, components: [component] }],
      history: [],
      historyIndex: -1,
    });

    useEditorStore.getState().removeComponentFromObject('hero', component.id);

    expect(useEditorStore.getState().objects[0].components).toEqual([]);
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('does not record history when removing a missing component', () => {
    const component = createComponentInstance('hero', 'pixl.physics2d');
    useEditorStore.setState({
      objects: [{ ...testObject, components: [component] }],
      history: [],
      historyIndex: -1,
    });

    useEditorStore.getState().removeComponentFromObject('hero', 'missing-component');

    expect(useEditorStore.getState().objects[0].components).toEqual([component]);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore, type SceneObject } from './editorStore';

const makeObject = (id: string, parentId: string | null = null): SceneObject => ({
  id,
  parentId,
  name: id,
  type: 'group',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#ffffff',
  visible: true,
  locked: false,
});

const resetHierarchy = () => {
  useEditorStore.setState({
    activeSceneKind: '3d',
    objects: [
      makeObject('root'),
      makeObject('child', 'root'),
      makeObject('grandchild', 'child'),
      makeObject('other'),
    ],
    selectedObjectId: null,
    history: [],
    historyIndex: -1,
  });
};

describe('editorStore hierarchy actions', () => {
  beforeEach(() => {
    resetHierarchy();
  });

  it('reparents objects and records history', () => {
    const changed = useEditorStore.getState().reparentObject('child', 'other');

    expect(changed).toBe(true);
    expect(useEditorStore.getState().objects.find((object) => object.id === 'child')?.parentId).toBe('other');
    expect(useEditorStore.getState().selectedObjectId).toBe('child');
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('can detach an object back to the scene root', () => {
    const changed = useEditorStore.getState().reparentObject('child', null);

    expect(changed).toBe(true);
    expect(useEditorStore.getState().objects.find((object) => object.id === 'child')?.parentId).toBeNull();
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('rejects missing, same, self, and cycle-producing parents as no-ops', () => {
    const before = useEditorStore.getState().objects;

    expect(useEditorStore.getState().reparentObject('missing', 'root')).toBe(false);
    expect(useEditorStore.getState().reparentObject('child', 'missing')).toBe(false);
    expect(useEditorStore.getState().reparentObject('child', 'child')).toBe(false);
    expect(useEditorStore.getState().reparentObject('child', 'root')).toBe(false);
    expect(useEditorStore.getState().reparentObject('root', 'grandchild')).toBe(false);

    expect(useEditorStore.getState().objects).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });

  it('reorders root siblings and records history', () => {
    const changed = useEditorStore.getState().reorderObject('other', 'root', 'before');

    expect(changed).toBe(true);
    expect(useEditorStore.getState().objects.map((object) => object.id)).toEqual([
      'other',
      'root',
      'child',
      'grandchild',
    ]);
    expect(useEditorStore.getState().objects.find((object) => object.id === 'other')?.parentId).toBeNull();
    expect(useEditorStore.getState().selectedObjectId).toBe('other');
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('moves a reordered subtree as one package and adopts the target parent', () => {
    const changed = useEditorStore.getState().reorderObject('child', 'other', 'after');

    expect(changed).toBe(true);
    expect(useEditorStore.getState().objects.map((object) => object.id)).toEqual([
      'root',
      'other',
      'child',
      'grandchild',
    ]);
    expect(useEditorStore.getState().objects.find((object) => object.id === 'child')?.parentId).toBeNull();
    expect(useEditorStore.getState().objects.find((object) => object.id === 'grandchild')?.parentId).toBe('child');
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('rejects invalid and already-satisfied reorders as no-ops', () => {
    const before = useEditorStore.getState().objects;

    expect(useEditorStore.getState().reorderObject('missing', 'root', 'before')).toBe(false);
    expect(useEditorStore.getState().reorderObject('child', 'missing', 'before')).toBe(false);
    expect(useEditorStore.getState().reorderObject('child', 'child', 'after')).toBe(false);
    expect(useEditorStore.getState().reorderObject('child', 'grandchild', 'after')).toBe(false);
    expect(useEditorStore.getState().reorderObject('root', 'other', 'before')).toBe(false);

    expect(useEditorStore.getState().objects).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });

  it('deletes a hierarchy subtree without leaving orphaned children', () => {
    useEditorStore.setState({ selectedObjectId: 'grandchild' });

    useEditorStore.getState().deleteObject('root');

    expect(useEditorStore.getState().objects.map((object) => object.id)).toEqual(['other']);
    expect(useEditorStore.getState().selectedObjectId).toBeNull();
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('does not record history when deleting a missing object', () => {
    const before = useEditorStore.getState().objects;

    useEditorStore.getState().deleteObject('missing');

    expect(useEditorStore.getState().objects).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });
});

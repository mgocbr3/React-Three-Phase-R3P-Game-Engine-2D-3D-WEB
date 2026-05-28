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
    objectClipboard: null,
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

  it('duplicates a hierarchy subtree with fresh object and component ids', () => {
    useEditorStore.setState({
      objects: [
        {
          ...makeObject('root'),
          components: [
            {
              id: 'root-tag',
              type: 'pixl.tag',
              enabled: true,
              data: { tags: ['spawner'] },
            },
          ],
        },
        {
          ...makeObject('child', 'root'),
          components: [
            {
              id: 'child-script',
              type: 'pixl.script',
              enabled: true,
              data: { instances: [] },
            },
          ],
        },
        makeObject('grandchild', 'child'),
        makeObject('other'),
      ],
      selectedObjectId: 'root',
      history: [],
      historyIndex: -1,
    });

    useEditorStore.getState().duplicateObject('root');

    const objects = useEditorStore.getState().objects;
    expect(objects).toHaveLength(7);

    const duplicatedRoot = objects.find((object) => object.name === 'root_copy');
    expect(duplicatedRoot).toBeDefined();
    expect(duplicatedRoot?.id).not.toBe('root');
    expect(duplicatedRoot?.parentId ?? null).toBeNull();
    expect(duplicatedRoot?.position).toEqual([2, 0, 0]);
    expect(duplicatedRoot?.components?.[0]).toMatchObject({
      type: 'pixl.tag',
      enabled: true,
      data: { tags: ['spawner'] },
    });
    expect(duplicatedRoot?.components?.[0].id).not.toBe('root-tag');

    const duplicatedChild = objects.find((object) => object.name === 'child_copy');
    const duplicatedGrandchild = objects.find((object) => object.name === 'grandchild_copy');
    expect(duplicatedChild?.parentId).toBe(duplicatedRoot?.id);
    expect(duplicatedChild?.components?.[0].id).not.toBe('child-script');
    expect(duplicatedGrandchild?.parentId).toBe(duplicatedChild?.id);

    expect(new Set(objects.map((object) => object.id))).toHaveProperty('size', objects.length);
    expect(useEditorStore.getState().selectedObjectId).toBe(duplicatedRoot?.id);
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('copies and pastes a hierarchy subtree without mutating the source selection', () => {
    useEditorStore.setState({
      objects: [
        {
          ...makeObject('root'),
          components: [
            {
              id: 'root-tag',
              type: 'pixl.tag',
              enabled: true,
              data: { tags: ['spawner'] },
            },
          ],
        },
        makeObject('child', 'root'),
        makeObject('grandchild', 'child'),
        makeObject('other'),
      ],
      selectedObjectId: 'root',
      history: [],
      historyIndex: -1,
    });

    const store = useEditorStore.getState() as ReturnType<typeof useEditorStore.getState> & {
      copyObject: (id: string) => boolean;
      pasteObject: () => string | null;
      hasObjectClipboard: () => boolean;
    };

    expect(store.copyObject('root')).toBe(true);
    expect(store.hasObjectClipboard()).toBe(true);
    expect(useEditorStore.getState().objects).toHaveLength(4);
    expect(useEditorStore.getState().history).toHaveLength(0);

    const pastedRootId = store.pasteObject();
    const objects = useEditorStore.getState().objects;
    const pastedRoot = objects.find((object) => object.id === pastedRootId);
    const pastedChild = objects.find((object) => object.name === 'child_copy');
    const pastedGrandchild = objects.find((object) => object.name === 'grandchild_copy');

    expect(objects).toHaveLength(7);
    expect(pastedRoot).toMatchObject({
      name: 'root_copy',
      parentId: null,
      position: [2, 0, 0],
    });
    expect(pastedRoot?.components?.[0]).toMatchObject({
      type: 'pixl.tag',
      data: { tags: ['spawner'] },
    });
    expect(pastedRoot?.components?.[0].id).not.toBe('root-tag');
    expect(pastedChild?.parentId).toBe(pastedRootId);
    expect(pastedGrandchild?.parentId).toBe(pastedChild?.id);
    expect(useEditorStore.getState().selectedObjectId).toBe(pastedRootId);
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it('cuts a hierarchy subtree into the object clipboard and records one history entry', () => {
    useEditorStore.setState({
      objects: [
        makeObject('root'),
        makeObject('child', 'root'),
        makeObject('grandchild', 'child'),
        makeObject('other'),
      ],
      selectedObjectId: 'child',
      history: [],
      historyIndex: -1,
      objectClipboard: null,
    });

    const store = useEditorStore.getState() as ReturnType<typeof useEditorStore.getState> & {
      cutObject: (id: string) => boolean;
      pasteObject: () => string | null;
      hasObjectClipboard: () => boolean;
    };

    expect(store.cutObject('child')).toBe(true);
    expect(store.hasObjectClipboard()).toBe(true);
    expect(useEditorStore.getState().objects.map((object) => object.id)).toEqual(['root', 'other']);
    expect(useEditorStore.getState().selectedObjectId).toBeNull();
    expect(useEditorStore.getState().history).toHaveLength(1);

    const pastedChildId = store.pasteObject();
    const objects = useEditorStore.getState().objects;
    const pastedChild = objects.find((object) => object.id === pastedChildId);
    const pastedGrandchild = objects.find((object) => object.name === 'grandchild_copy');

    expect(objects).toHaveLength(4);
    expect(pastedChild).toMatchObject({
      name: 'child_copy',
      parentId: 'root',
      position: [2, 0, 0],
    });
    expect(pastedGrandchild?.parentId).toBe(pastedChildId);
    expect(useEditorStore.getState().selectedObjectId).toBe(pastedChildId);
    expect(useEditorStore.getState().history).toHaveLength(2);
  });

  it('treats missing copy sources and empty paste buffers as no-ops', () => {
    const store = useEditorStore.getState() as ReturnType<typeof useEditorStore.getState> & {
      copyObject: (id: string) => boolean;
      cutObject: (id: string) => boolean;
      pasteObject: () => string | null;
      hasObjectClipboard: () => boolean;
    };
    const before = useEditorStore.getState().objects;

    expect(store.copyObject('missing')).toBe(false);
    expect(store.cutObject('missing')).toBe(false);
    expect(store.hasObjectClipboard()).toBe(false);
    expect(store.pasteObject()).toBeNull();
    expect(useEditorStore.getState().objects).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });
});

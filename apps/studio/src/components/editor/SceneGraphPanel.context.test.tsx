import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SceneGraphPanel } from './SceneGraphPanel';
import { useEditorStore, type SceneObject } from '@/stores/editorStore';

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

describe('SceneGraphPanel context menu', () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeSceneKind: '3d',
      objects: [
        makeObject('source'),
        makeObject('child', 'source'),
        makeObject('target'),
      ],
      selectedObjectId: null,
      history: [],
      historyIndex: -1,
      objectClipboard: null,
    });
  });

  it('pastes the copied object subtree as a child from the row context menu', () => {
    useEditorStore.getState().copyObject('source');

    render(<SceneGraphPanel />);

    fireEvent.contextMenu(screen.getByText('target'));
    fireEvent.click(screen.getByRole('button', { name: 'Colar como filho' }));

    const objects = useEditorStore.getState().objects;
    const pastedRoot = objects.find((object) => object.name === 'source_copy');
    const pastedChild = objects.find((object) => object.name === 'child_copy');

    expect(pastedRoot?.parentId).toBe('target');
    expect(pastedChild?.parentId).toBe(pastedRoot?.id);
    expect(useEditorStore.getState().selectedObjectId).toBe(pastedRoot?.id);
  });

  it('pastes the copied object subtree at the scene root from the root context menu', () => {
    useEditorStore.getState().copyObject('child');

    render(<SceneGraphPanel />);

    fireEvent.contextMenu(screen.getByTestId('scene-root-drop-target'));
    fireEvent.click(screen.getByRole('button', { name: 'Colar na raiz' }));

    const objects = useEditorStore.getState().objects;
    const pastedChild = objects.find((object) => object.name === 'child_copy');

    expect(pastedChild?.parentId).toBeNull();
    expect(useEditorStore.getState().selectedObjectId).toBe(pastedChild?.id);
  });

  it('uses 2D object icons instead of cube icons in the hierarchy', () => {
    useEditorStore.setState({
      activeSceneKind: '2d',
      objects: [
        { ...makeObject('sprite'), type: 'sprite' },
        { ...makeObject('rect'), type: 'rectangle' },
        { ...makeObject('label'), type: 'text' },
      ],
      selectedObjectId: null,
    });

    render(<SceneGraphPanel />);

    expect(screen.getByTestId('scene-object-sprite').querySelector('.lucide-image')).not.toBeNull();
    expect(screen.getByTestId('scene-object-rect').querySelector('.lucide-square')).not.toBeNull();
    expect(screen.getByTestId('scene-object-label').querySelector('.lucide-type')).not.toBeNull();
    expect(screen.getByTestId('scene-object-sprite').querySelector('.lucide-box')).toBeNull();
  });
});

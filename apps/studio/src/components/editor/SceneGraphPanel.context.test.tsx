import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SceneGraphPanel } from './SceneGraphPanel';
import { useEditorStore, type SceneObject } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';

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
    useRuntimeGameStore.getState().stopPreview();
    useEditorStore.setState({
      activeSceneKind: '3d',
      isEditMode: true,
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

  it('locks mutating hierarchy context actions while Play Mode is active', () => {
    useEditorStore.getState().copyObject('source');
    useEditorStore.setState({ isEditMode: false });

    render(<SceneGraphPanel />);

    fireEvent.contextMenu(screen.getByText('target'));

    expect(screen.getByRole('button', { name: 'Renomear' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplicar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Colar como filho' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deletar' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Deletar' }));
    expect(useEditorStore.getState().objects.some((object) => object.id === 'target')).toBe(true);
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

  it('keeps hierarchy as one flat dock tab without unused subtabs', () => {
    const { container } = render(<SceneGraphPanel />);

    expect(container.querySelector('.editor-dock-outline')).toBeNull();
    expect(container.querySelectorAll('.panel-header')).toHaveLength(1);
    expect(container.querySelectorAll('.editor-panel-tab')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Hierarchy' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Scene' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar...')).toBeVisible();
  });
});

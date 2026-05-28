import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from '@/stores/editorStore';
import { useViewportStore } from '@/stores/viewportStore';
import { EditorToolbar } from './EditorToolbar';

describe('EditorToolbar scene-aware tools', () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeSceneKind: '3d',
      transformMode: 'translate',
      isEditMode: true,
      objects: [],
      selectedObjectId: null,
      focusTarget: null,
    });
    useViewportStore.setState({ viewportMode: '3d', lockedKind: null });
  });

  it('uses 2D tool labels when the project kind is locked to Phaser', () => {
    useViewportStore.getState().setLockedKind('2d');

    render(<EditorToolbar variant="inline" />);

    expect(screen.getByTitle('Select 2D (Q)')).toBeVisible();
    expect(screen.getByTitle('Move 2D (W)')).toBeVisible();
    expect(screen.getByTitle('Rotate 2D (E)')).toBeVisible();
    expect(screen.getByTitle('Scale 2D (R)')).toBeVisible();
    expect(screen.queryByTitle('Select (Free Camera) (Q)')).not.toBeInTheDocument();
  });

  it('keeps 3D camera wording in Three.js projects', () => {
    render(<EditorToolbar variant="inline" />);

    expect(screen.getByTitle('Select (Free Camera) (Q)')).toBeVisible();
    expect(screen.getByTitle('Move 3D (W)')).toBeVisible();
    expect(screen.getByTitle('Rotate 3D (E)')).toBeVisible();
    expect(screen.getByTitle('Scale 3D (R)')).toBeVisible();
    expect(screen.queryByTitle('Select 2D (Q)')).not.toBeInTheDocument();
  });

  it('locks Add while Play Mode is active', () => {
    useEditorStore.setState({ activeSceneKind: '2d', isEditMode: false });

    render(<EditorToolbar variant="inline" />);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('frames the selected object with the Unity-like F shortcut', () => {
    useEditorStore.setState({
      objects: [{
        id: 'crate',
        name: 'Crate',
        type: 'box',
        position: [3, 4, 5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#ffffff',
        visible: true,
        locked: false,
      }],
      selectedObjectId: 'crate',
      focusTarget: null,
    });

    render(<EditorToolbar variant="inline" />);

    fireEvent.keyDown(window, { key: 'f' });

    expect(useEditorStore.getState().focusTarget?.position).toEqual([3, 4, 5]);
  });

  it('frames the selected object from the toolbar control', () => {
    useEditorStore.setState({
      objects: [{
        id: 'crate',
        name: 'Crate',
        type: 'box',
        position: [3, 4, 5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#ffffff',
        visible: true,
        locked: false,
      }],
      selectedObjectId: 'crate',
      focusTarget: null,
    });

    render(<EditorToolbar variant="inline" />);

    fireEvent.click(screen.getByTitle('Frame Selected (F)'));

    expect(useEditorStore.getState().focusTarget?.position).toEqual([3, 4, 5]);
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from '@/stores/editorStore';
import { useViewportStore } from '@/stores/viewportStore';
import { EditorToolbar } from './EditorToolbar';

describe('EditorToolbar scene-aware tools', () => {
  beforeEach(() => {
    useEditorStore.setState({ activeSceneKind: '3d', transformMode: 'translate' });
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
});

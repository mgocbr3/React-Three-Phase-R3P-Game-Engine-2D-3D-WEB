import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from '@/stores/editorStore';
import { useEditorLayoutStore } from '@/stores/editorLayoutStore';
import { EditorHeader } from './EditorHeader';

describe('EditorHeader layout selector', () => {
  beforeEach(() => {
    useEditorLayoutStore.getState().resetLayout();
    useEditorStore.setState({ activeSceneKind: '3d' });
  });

  it('applies Unity-like layout presets from the top toolbar', () => {
    render(
      <MemoryRouter>
        <EditorHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    expect(screen.getByRole('button', { name: 'Save Current Layout' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Viewport Focus' }));

    expect(useEditorLayoutStore.getState().panels).toEqual({
      scene: false,
      viewport: true,
      inspector: false,
      bottom: false,
    });
  });

  it('uses 2D creation entries in the Scene menu for 2D projects', () => {
    useEditorStore.setState({ activeSceneKind: '2d' });

    render(
      <MemoryRouter>
        <EditorHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Scene' }));

    expect(screen.getByRole('button', { name: 'Square' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sprite' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cube' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terrain' })).not.toBeInTheDocument();
  });
});

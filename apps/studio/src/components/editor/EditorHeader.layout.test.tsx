import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorLayoutStore } from '@/stores/editorLayoutStore';
import { EditorHeader } from './EditorHeader';

describe('EditorHeader layout selector', () => {
  beforeEach(() => {
    useEditorLayoutStore.getState().resetLayout();
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
});

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore } from '@/stores/editorStore';
import { useEditorLayoutStore } from '@/stores/editorLayoutStore';
import { useBottomPanelTabsStore } from '@/stores/bottomPanelTabsStore';
import { EditorHeader } from './EditorHeader';

describe('EditorHeader layout selector', () => {
  beforeEach(() => {
    useEditorLayoutStore.getState().resetLayout();
    useBottomPanelTabsStore.getState().resetTabs();
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

  it('uses fixed checked Window entries and names the 2D viewport Preview 2D', () => {
    useEditorStore.setState({ activeSceneKind: '2d' });

    render(
      <MemoryRouter>
        <EditorHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Window' }));

    const previewItem = screen.getByRole('menuitemcheckbox', { name: 'Preview 2D' });
    expect(previewItem).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Hide Scene View' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Scene View' })).not.toBeInTheDocument();

    fireEvent.click(previewItem);
    expect(useEditorLayoutStore.getState().panels.viewport).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Window' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Preview 2D' })).toHaveAttribute('aria-checked', 'false');
  });

  it('uses the dock viewport name in the 3D Window menu', () => {
    render(
      <MemoryRouter>
        <EditorHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Window' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Scene 3D' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Scene View' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dock Scene 3D Center' })).toBeVisible();
  });

  it('saves and reloads bottom tab layout with the Unity-like layout command', () => {
    useBottomPanelTabsStore.getState().moveTabToEnd('assets');
    useBottomPanelTabsStore.getState().closeTab('ui');
    useBottomPanelTabsStore.getState().setActiveTab('console');

    render(
      <MemoryRouter>
        <EditorHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Current Layout' }));

    useBottomPanelTabsStore.getState().resetTabs();

    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load Saved Layout' }));

    const state = useBottomPanelTabsStore.getState();
    expect(state.tabOrder).toEqual(['ui', 'timeline', 'console', 'assets']);
    expect(state.closedTabs).toEqual(['ui']);
    expect(state.activeTab).toBe('console');
  });
});

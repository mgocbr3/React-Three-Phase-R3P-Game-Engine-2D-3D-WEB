import { beforeEach, describe, expect, it } from 'vitest';

import {
  defaultDockOrder,
  normalizeDockOrder,
  useEditorLayoutStore,
  type EditorPanelId,
} from './editorLayoutStore';

describe('editorLayoutStore dock layout', () => {
  beforeEach(() => {
    useEditorLayoutStore.getState().resetLayout();
  });

  it('treats the scene viewport as a dockable panel', () => {
    expect(defaultDockOrder).toEqual(['scene', 'viewport', 'inspector', 'bottom']);
    expect(useEditorLayoutStore.getState().panels.viewport).toBe(true);
  });

  it('moves dock panels by dragging one panel before another', () => {
    useEditorLayoutStore.getState().movePanelBefore('bottom', 'scene');

    expect(useEditorLayoutStore.getState().dockOrder).toEqual(['bottom', 'scene', 'viewport', 'inspector']);
  });

  it('moves dock panels to the end of the dock row', () => {
    useEditorLayoutStore.getState().movePanelToEnd('scene');

    expect(useEditorLayoutStore.getState().dockOrder).toEqual(['viewport', 'inspector', 'bottom', 'scene']);
  });

  it('keeps hidden panels in the dock order so Window can insert them again', () => {
    useEditorLayoutStore.getState().setPanelVisible('viewport', false);
    useEditorLayoutStore.getState().movePanelBefore('bottom', 'scene');
    useEditorLayoutStore.getState().setPanelVisible('viewport', true);

    const state = useEditorLayoutStore.getState();
    expect(state.panels.viewport).toBe(true);
    expect(state.dockOrder).toEqual(['bottom', 'scene', 'viewport', 'inspector']);
  });

  it('normalizes old saved layouts with missing or duplicated panel ids', () => {
    expect(normalizeDockOrder(['bottom', 'scene', 'scene'] as EditorPanelId[])).toEqual([
      'bottom',
      'scene',
      'viewport',
      'inspector',
    ]);
  });
});

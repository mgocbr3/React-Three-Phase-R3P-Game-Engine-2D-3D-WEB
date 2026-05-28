import { beforeEach, describe, expect, it } from 'vitest';

import {
  defaultDockOrder,
  normalizeDockOrder,
  previewDockMove,
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

  it('can dock the content browser back into the bottom zone', () => {
    useEditorLayoutStore.getState().movePanelBefore('bottom', 'scene');
    expect(useEditorLayoutStore.getState().panelZones.bottom).toBe('main');

    useEditorLayoutStore.getState().movePanelToZone('bottom', 'bottom');

    const state = useEditorLayoutStore.getState();
    expect(state.panelZones.bottom).toBe('bottom');
    expect(state.panels.bottom).toBe(true);
  });

  it('previews a dock move before the mouse is released', () => {
    useEditorLayoutStore.getState().movePanelBefore('bottom', 'scene');
    const state = useEditorLayoutStore.getState();
    const preview = previewDockMove(state.dockOrder, state.panelZones, 'bottom', 'bottom-end');

    expect(preview.panelZones.bottom).toBe('bottom');
    expect(preview.dockOrder).toEqual(['scene', 'viewport', 'inspector', 'bottom']);
  });

  it('keeps hidden panels in the dock order so Window can insert them again', () => {
    useEditorLayoutStore.getState().setPanelVisible('viewport', false);
    useEditorLayoutStore.getState().movePanelBefore('bottom', 'scene');
    useEditorLayoutStore.getState().setPanelVisible('viewport', true);

    const state = useEditorLayoutStore.getState();
    expect(state.panels.viewport).toBe(true);
    expect(state.dockOrder).toEqual(['bottom', 'scene', 'viewport', 'inspector']);
  });

  it('restores the project panel below when Window shows it again', () => {
    useEditorLayoutStore.getState().movePanelBefore('bottom', 'scene');
    useEditorLayoutStore.getState().togglePanel('bottom');
    useEditorLayoutStore.getState().togglePanel('bottom');

    const state = useEditorLayoutStore.getState();
    expect(state.panels.bottom).toBe(true);
    expect(state.panelZones.bottom).toBe('bottom');
    expect(state.dockOrder).toEqual(['scene', 'viewport', 'inspector', 'bottom']);
  });

  it('shows every panel from Window without resetting the custom dock order', () => {
    useEditorLayoutStore.getState().movePanelToEnd('scene');
    useEditorLayoutStore.getState().setPanelVisible('viewport', false);
    useEditorLayoutStore.getState().showAllPanels();

    const state = useEditorLayoutStore.getState();
    expect(state.panels).toEqual({
      scene: true,
      viewport: true,
      inspector: true,
      bottom: true,
    });
    expect(state.dockOrder).toEqual(['viewport', 'inspector', 'bottom', 'scene']);
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

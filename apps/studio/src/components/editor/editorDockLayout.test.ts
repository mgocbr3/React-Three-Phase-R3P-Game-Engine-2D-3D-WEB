import { describe, expect, it } from 'vitest';

import { getDockPanelSize } from './editorDockLayout';
import { defaultDockOrder, type EditorPanelId } from '@/stores/editorLayoutStore';

const totalDefaultSize = (ids: EditorPanelId[]) => (
  ids.reduce((sum, id) => sum + getDockPanelSize(id, ids).defaultSize, 0)
);

describe('editorDockLayout', () => {
  it('keeps visible dock panel default sizes normalized to 100%', () => {
    expect(totalDefaultSize(defaultDockOrder)).toBeCloseTo(100);
    expect(totalDefaultSize(['viewport', 'inspector', 'bottom'])).toBeCloseTo(100);
    expect(totalDefaultSize(['viewport'])).toBe(100);
  });

  it('keeps the scene view dominant when side panels are visible', () => {
    const viewport = getDockPanelSize('viewport', ['viewport', 'inspector', 'bottom']).defaultSize;
    const inspector = getDockPanelSize('inspector', ['viewport', 'inspector', 'bottom']).defaultSize;

    expect(viewport).toBeGreaterThan(inspector);
  });
});

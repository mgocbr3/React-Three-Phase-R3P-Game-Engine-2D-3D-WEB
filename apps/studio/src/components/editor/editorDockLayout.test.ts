import { describe, expect, it } from 'vitest';

import {
  getDockDropPreviewRect,
  getDockDragGhostPosition,
  getDockPanelLabels,
  getDockPanelSize,
  getDockZoneLayout,
  resolveDockTargetFromRects,
} from './editorDockLayout';
import { defaultDockOrder, type EditorPanelId } from '@/stores/editorLayoutStore';

const totalDefaultSize = (ids: EditorPanelId[]) => (
  ids.reduce((sum, id) => sum + getDockPanelSize(id, ids).defaultSize, 0)
);

describe('editorDockLayout', () => {
  it('keeps dock panel labels consistent across 2D and 3D layouts', () => {
    expect(getDockPanelLabels('2d')).toEqual({
      scene: 'Hierarchy',
      viewport: 'Preview 2D',
      inspector: 'Inspector',
      bottom: 'Project',
    });
    expect(getDockPanelLabels('3d').viewport).toBe('Scene 3D');
  });

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

  it('lets the bottom zone fill the editor when it is the only visible zone', () => {
    expect(getDockZoneLayout([], ['bottom'])).toEqual({
      showMain: false,
      showBottom: true,
      mainDefaultSize: 0,
      bottomDefaultSize: 100,
    });
    expect(getDockZoneLayout(['viewport'], ['bottom'])).toEqual({
      showMain: true,
      showBottom: true,
      mainDefaultSize: 72,
      bottomDefaultSize: 28,
    });
  });

  it('uses panel halves to resolve live dock preview targets', () => {
    const panels = [
      { id: 'scene', zone: 'main', left: 0, top: 64, width: 240, height: 520 },
      { id: 'viewport', zone: 'main', left: 240, top: 64, width: 680, height: 520 },
      { id: 'inspector', zone: 'main', left: 920, top: 64, width: 280, height: 520 },
    ] as const;

    expect(resolveDockTargetFromRects({ x: 260, y: 120, viewportHeight: 900, panels })).toBe('viewport');
    expect(resolveDockTargetFromRects({ x: 890, y: 120, viewportHeight: 900, panels })).toBe('inspector');
    expect(resolveDockTargetFromRects({ x: 1180, y: 120, viewportHeight: 900, panels })).toBe('main-end');
  });

  it('keeps a broad bottom magnet for docking panels below', () => {
    expect(resolveDockTargetFromRects({ x: 700, y: 760, viewportHeight: 900, panels: [] })).toBe('bottom-end');
  });

  it('still resolves panel slots inside the bottom dock row', () => {
    const panels = [
      { id: 'viewport', zone: 'main', left: 0, top: 64, width: 900, height: 520 },
      { id: 'bottom', zone: 'bottom', left: 0, top: 600, width: 900, height: 260 },
    ] as const;

    expect(resolveDockTargetFromRects({ x: 120, y: 720, viewportHeight: 900, panels })).toBe('bottom');
    expect(resolveDockTargetFromRects({ x: 760, y: 720, viewportHeight: 900, panels })).toBe('bottom-end');
  });

  it('keeps the floating dock preview inside the viewport', () => {
    expect(getDockDragGhostPosition({ x: 900, y: 680, viewportWidth: 960, viewportHeight: 720 })).toEqual({
      left: 724,
      top: 632,
    });
  });

  it('snaps the floating dock preview to the active panel target', () => {
    expect(getDockDragGhostPosition({
      x: 760,
      y: 420,
      viewportWidth: 1200,
      viewportHeight: 900,
      target: 'viewport',
      panels: [
        { id: 'scene', zone: 'main', left: 0, top: 64, width: 240, height: 520 },
        { id: 'viewport', zone: 'main', left: 240, top: 64, width: 680, height: 520 },
      ],
    })).toEqual({ left: 252, top: 76 });
  });

  it('draws Unity-like dock preview slots for panel, row-end, and bottom targets', () => {
    const panels = [
      { id: 'scene', zone: 'main', left: 0, top: 64, width: 240, height: 520 },
      { id: 'viewport', zone: 'main', left: 240, top: 64, width: 680, height: 520 },
      { id: 'inspector', zone: 'main', left: 920, top: 64, width: 280, height: 520 },
    ] as const;

    expect(getDockDropPreviewRect({ target: 'viewport', panels, viewportWidth: 1200, viewportHeight: 900 })).toEqual({
      left: 237,
      top: 64,
      width: 6,
      height: 520,
    });
    expect(getDockDropPreviewRect({ target: 'main-end', panels, viewportWidth: 1200, viewportHeight: 900 })).toEqual({
      left: 1194,
      top: 64,
      width: 6,
      height: 520,
    });
    expect(getDockDropPreviewRect({ target: 'bottom-end', panels, viewportWidth: 1200, viewportHeight: 900 })).toEqual({
      left: 12,
      top: 594,
      width: 1176,
      height: 294,
    });
  });
});

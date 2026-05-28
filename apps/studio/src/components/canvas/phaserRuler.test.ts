import { describe, expect, it } from 'vitest';

import {
  formatPointerPosition,
  formatRulerMark,
  getEditorZoom,
  getEditorSceneFit,
  getFittedViewportCamera,
  setFittedViewportCamera,
  getViewportGridLines,
  getRulerMarks,
  getViewportRulerTicks,
  getZoomedScroll,
} from './phaserRuler';

describe('phaserRuler', () => {
  it('creates symmetric major ruler marks around the origin', () => {
    expect(getRulerMarks(1024, 512)).toEqual([-1024, -512, 0, 512, 1024]);
  });

  it('formats ruler marks as compact world coordinates', () => {
    expect(formatRulerMark(-512)).toBe('-512');
    expect(formatRulerMark(0)).toBe('0');
  });

  it('creates viewport ruler ticks from camera scroll and zoom', () => {
    expect(getViewportRulerTicks(96, 220, 1, 64, 4)).toEqual([
      { screen: -32, world: 64, labeled: false },
      { screen: 32, world: 128, labeled: false },
      { screen: 96, world: 192, labeled: false },
      { screen: 160, world: 256, labeled: true },
      { screen: 224, world: 320, labeled: false },
    ]);
  });

  it('formats pointer world position for the 2D editor overlay', () => {
    expect(formatPointerPosition(12.4, -8.6)).toBe('X 12  Y -9');
  });

  it('creates tile grid lines with major world cells', () => {
    expect(getViewportGridLines(100, 130, 1, 32, 4)).toEqual([
      { screen: -4, world: 96, major: false },
      { screen: 28, world: 128, major: true },
      { screen: 60, world: 160, major: false },
      { screen: 92, world: 192, major: false },
      { screen: 124, world: 224, major: false },
      { screen: 156, world: 256, major: true },
    ]);
  });

  it('zooms around the pointer without changing the pointed world coordinate', () => {
    expect(getEditorZoom(1, -120)).toBe(1.1);
    expect(getEditorZoom(0.26, 120)).toBe(0.25);
    expect(getZoomedScroll(100, 200, 1, 2)).toBe(200);
  });

  it('centers scene bounds inside the 2D editor viewport', () => {
    const fit = getFittedViewportCamera(
      { minX: 0, minY: 0, maxX: 800, maxY: 600 },
      { width: 1600, height: 900 },
      96,
    );

    expect(fit.zoom).toBeCloseTo(1.18);
    expect((0 - fit.scrollX) * fit.zoom).toBeCloseTo(328);
    expect((800 - fit.scrollX) * fit.zoom).toBeCloseTo(1272);
  });

  it('reapplies the fitted camera when the preview viewport changes size', () => {
    const camera = {
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      setScroll(x: number, y: number) {
        this.scrollX = x;
        this.scrollY = y;
      },
      setZoom(zoom: number) {
        this.zoom = zoom;
      },
    };

    setFittedViewportCamera(camera, { minX: 0, minY: 0, maxX: 800, maxY: 600 }, { width: 900, height: 640 }, 96);
    const small = { scrollX: camera.scrollX, zoom: camera.zoom };
    const large = setFittedViewportCamera(camera, { minX: 0, minY: 0, maxX: 800, maxY: 600 }, { width: 1600, height: 900 }, 96);

    expect(large.zoom).toBeGreaterThan(small.zoom);
    expect(camera.zoom).toBe(large.zoom);
    expect(camera.scrollX).toBe(large.scrollX);
    expect(camera.scrollX).not.toBe(small.scrollX);
  });

  it('fits the 2D editor around the camera frame and visible content', () => {
    const fit = getEditorSceneFit([
      { type: 'image', position: [400, 300, 0], scale: [1, 1, 1], data: { displayWidth: 800, displayHeight: 600 } },
      { type: 'sprite', position: [5000, 300, 0], visible: false, scale: [1, 1, 1], data: { frameWidth: 72, frameHeight: 96 } },
    ], { width: 1600, height: 900 }, { width: 960, height: 540 });

    expect(fit.zoom).toBeCloseTo(1.18);
    expect((0 - fit.scrollX) * fit.zoom).toBeCloseTo(234, 0);
    expect((960 - fit.scrollX) * fit.zoom).toBeCloseTo(1366, 0);
  });
});

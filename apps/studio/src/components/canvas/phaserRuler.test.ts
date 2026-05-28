import { describe, expect, it } from 'vitest';

import {
  formatPointerPosition,
  formatRulerMark,
  getRulerMarks,
  getViewportRulerTicks,
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
});

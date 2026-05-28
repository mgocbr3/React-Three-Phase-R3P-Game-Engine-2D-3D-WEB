import { describe, expect, it } from 'vitest';

import { formatRulerMark, getRulerMarks } from './phaserRuler';

describe('phaserRuler', () => {
  it('creates symmetric major ruler marks around the origin', () => {
    expect(getRulerMarks(1024, 512)).toEqual([-1024, -512, 0, 512, 1024]);
  });

  it('formats ruler marks as compact world coordinates', () => {
    expect(formatRulerMark(-512)).toBe('-512');
    expect(formatRulerMark(0)).toBe('0');
  });
});

import { describe, expect, it } from 'vitest';

import { readPhaserViewportSize } from './PhaserRuntimeMount';

const host = (rectWidth: number, rectHeight: number, clientWidth: number, clientHeight: number) => ({
  clientWidth,
  clientHeight,
  getBoundingClientRect: () => ({ width: rectWidth, height: rectHeight }),
}) as HTMLElement;

describe('PhaserRuntimeMount', () => {
  it('uses the rendered panel size when client dimensions are stale after docking', () => {
    expect(readPhaserViewportSize(host(1836.4, 1082.6, 1496, 900))).toEqual({
      width: 1836,
      height: 1083,
    });
  });
});

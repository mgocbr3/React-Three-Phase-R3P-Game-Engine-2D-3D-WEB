import { describe, expect, it } from 'vitest';

import { canInstallRuntimeScript, clearPixlPhaserGameGlobal, readEditorViewportPointer, readPhaserViewportSize } from './PhaserRuntimeMount';

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

  it('reads editor pointer coordinates from the inset 2D canvas area', () => {
    expect(readEditorViewportPointer(host(800, 600, 800, 600), 120, 90)).toEqual({ x: 120, y: 90 });
    expect(readEditorViewportPointer(host(800, 600, 800, 600), -1, 90)).toBeNull();
  });

  it('skips async runtime script setup after the Phaser scene is destroyed', () => {
    expect(canInstallRuntimeScript({ input: { keyboard: { manager: null } } })).toBe(false);
    expect(canInstallRuntimeScript({ input: { keyboard: { manager: {} } } })).toBe(true);
  });

  it('clears only the matching global Phaser game on unmount', () => {
    const game = {};
    const nextGame = {};
    const win = { __pixlPhaserGame: game };

    clearPixlPhaserGameGlobal(win, nextGame);
    expect(win.__pixlPhaserGame).toBe(game);

    clearPixlPhaserGameGlobal(win, game);
    expect('__pixlPhaserGame' in win).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  canInstallRuntimeScript,
  clearPixlPhaserGameGlobal,
  getPhaserRuntimeChromeState,
  getRuntimeCameraView,
  getSnapped2DTransformValue,
  readEditorViewportPointer,
  readPhaserViewportSize,
  shouldCommit2DDragHistory,
  shouldAutoFit2DEditorCamera,
} from './PhaserRuntimeMount';

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

  it('removes editor chrome from the 2D runtime surface while playing', () => {
    expect(getPhaserRuntimeChromeState(true, 'ready')).toEqual({
      allowEditorInput: false,
      showEditorOverlay: false,
      viewportInset: 0,
    });
    expect(getPhaserRuntimeChromeState(false, 'ready')).toMatchObject({
      allowEditorInput: true,
      showEditorOverlay: true,
    });
  });

  it('uses the exported camera pose for 2D play mode', () => {
    expect(getRuntimeCameraView({ position: { x: 0, y: 0 }, zoom: 1 })).toEqual({
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
    });
    expect(getRuntimeCameraView({ position: { x: 140, y: 80 }, zoom: 1.5 })).toEqual({
      scrollX: 140,
      scrollY: 80,
      zoom: 1.5,
    });
  });

  it('keeps editor auto-fit out of 2D play mode', () => {
    expect(shouldAutoFit2DEditorCamera({ isPlaying: true, hasAutoFit: true })).toBe(false);
    expect(shouldAutoFit2DEditorCamera({ isPlaying: false, hasAutoFit: true })).toBe(true);
  });

  it('snaps 2D transform values to the editor translate grid', () => {
    expect(getSnapped2DTransformValue(127, { snapEnabled: true, snapTranslate: 32 })).toBe(128);
    expect(getSnapped2DTransformValue(127, { snapEnabled: false, snapTranslate: 32 })).toBe(127);
    expect(getSnapped2DTransformValue(127, { snapEnabled: true, snapTranslate: 0 })).toBe(127);
  });

  it('commits one 2D drag history entry only after a real transform change', () => {
    expect(shouldCommit2DDragHistory([10, 20, 0], [42, 20, 0])).toBe(true);
    expect(shouldCommit2DDragHistory([10, 20, 0], [10, 20, 0])).toBe(false);
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

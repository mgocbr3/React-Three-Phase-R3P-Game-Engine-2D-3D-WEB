import { describe, expect, it } from 'vitest';

import {
  canInstallRuntimeScript,
  clearPixlPhaserGameGlobal,
  getRenderBounds,
  getPhaserRuntimeChromeState,
  getRuntimeCameraView,
  getRuntimePlaySurfaceLayout,
  pickEditorHitObjectId,
  resolvePhaserRuntimeAssetBaseUrl,
  getSpriteOrigin2D,
  getSnapped2DTransformValue,
  readEditorViewportPointer,
  readPhaserViewportSize,
  shouldRunRuntimeTick,
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

  it('does not fall back to sample-2d when an editor project document is supplied', () => {
    expect(resolvePhaserRuntimeAssetBaseUrl(undefined, { id: 'local-2d' })).toBe('/');
    expect(resolvePhaserRuntimeAssetBaseUrl('/sample-projects/pokemon-vertical-slice-2d', { id: 'sample' })).toBe(
      '/sample-projects/pokemon-vertical-slice-2d',
    );
    expect(resolvePhaserRuntimeAssetBaseUrl(undefined, null)).toBe('/sample-projects/sample-2d');
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

  it('letterboxes the exported 2D game surface inside fullscreen play frames', () => {
    expect(getRuntimePlaySurfaceLayout({ width: 1600, height: 600 })).toEqual({
      width: 800,
      height: 600,
      displayWidth: 800,
      displayHeight: 600,
      offsetX: 400,
      offsetY: 0,
    });
    expect(getRuntimePlaySurfaceLayout({ width: 1600, height: 1200 })).toEqual({
      width: 800,
      height: 600,
      displayWidth: 1600,
      displayHeight: 1200,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('keeps editor auto-fit out of 2D play mode', () => {
    expect(shouldAutoFit2DEditorCamera({ isPlaying: true, hasAutoFit: true })).toBe(false);
    expect(shouldAutoFit2DEditorCamera({ isPlaying: false, hasAutoFit: true })).toBe(true);
  });

  it('runs gameplay script ticks only while Play Mode is active', () => {
    expect(shouldRunRuntimeTick(false)).toBe(false);
    expect(shouldRunRuntimeTick(true)).toBe(true);
  });

  it('selects the topmost editable 2D object from pointer hits', () => {
    const hit = (id: string | null, depth: number, name = id ?? 'no-id') => ({
      depth,
      name,
      getData: (key: string) => (key === 'pixlId' ? id : undefined),
    });

    expect(pickEditorHitObjectId([
      hit('arena-bg', -10, 'Arena Backdrop'),
      hit('player-mage', 10, 'Player Mage'),
      hit('hp-bar', 100, 'HP Bar'),
    ])).toBe('hp-bar');
    expect(pickEditorHitObjectId([
      hit(null, 9999, '__pixl_selection_outline'),
      hit('player-mage', 10, 'Player Mage'),
    ])).toBe('player-mage');
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

  it('resolves 2D sprite origin from data and sprite components', () => {
    expect(getSpriteOrigin2D({ data: {} })).toEqual({ x: 0.5, y: 0.5 });
    expect(getSpriteOrigin2D({ data: { centered: false } })).toEqual({ x: 0, y: 0 });
    expect(getSpriteOrigin2D({ data: { origin: { x: 0.25, y: 0.75 } } })).toEqual({ x: 0.25, y: 0.75 });
    expect(getSpriteOrigin2D({
      data: {},
      components: [{ type: 'pixl.sprite', enabled: true, origin: { x: 0.1, y: 0.9 } }],
    })).toEqual({ x: 0.1, y: 0.9 });
  });

  it('uses sprite origin when measuring 2D render bounds', () => {
    expect(getRenderBounds({
      id: 'sprite',
      name: 'Sprite',
      type: 'sprite',
      transform: {
        position: { x: 100, y: 80 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
      data: { displayWidth: 40, displayHeight: 20, origin: { x: 0, y: 1 } },
    })).toEqual({ minX: 100, minY: 60, maxX: 140, maxY: 80 });
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

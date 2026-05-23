// GDD §6.6 — Phase 6B step 5+6.
// The viewport. Picks Three vs Phaser based on the active scene kind.
// Both canvases live in the React tree simultaneously (D7) — `visible`
// toggles `display: block | none` so the WebGL context survives toggles.
//
// Source-of-truth precedence (highest wins):
//   1. Explicit `sceneKind` prop (rarely used — programmatic override)
//   2. useViewportStore.viewportMode — the global toggle the toolbar
//      writes when the user clicks the 2D/3D buttons. **This is what
//      makes the header toggle actually drive the viewport.**
//   3. URL `?kind=2d|3d` query param — boot-time seed only.

import React, { useEffect, useMemo, useRef } from 'react';

import { useViewportStore } from '@/stores/viewportStore';

import { PhaserRuntimeMount } from './PhaserRuntimeMount';
import { ThreeRuntimeMount } from './ThreeRuntimeMount';

export type SceneKind = '2d' | '3d';

export interface ViewportProps {
  /** Override the scene kind. If omitted, reads `?kind=` from the URL. */
  sceneKind?: SceneKind;
  /** Base URL for the 3D mount. */
  assetBaseUrl3D?: string;
  /** Base URL for the 2D mount. */
  assetBaseUrl2D?: string;
  initialScene?: string;
}

const readKindFromUrl = (): SceneKind => {
  if (typeof window === 'undefined') return '3d';
  const k = new URLSearchParams(window.location.search).get('kind');
  return k === '2d' ? '2d' : '3d';
};

// Map ?sampleProject=<slug> (or ?project=<slug>) to the public path the
// runtime mounts will fetch project.pixlproject.json from. Keeps the Viewport
// usable with any sample under apps/studio/public/sample-projects/ without
// hardcoding harvest-rush.
const readSampleBaseUrlFromUrl = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const sp = new URLSearchParams(window.location.search);
  const slug = sp.get('sampleProject') ?? sp.get('project');
  return slug ? `/sample-projects/${slug}` : undefined;
};

export function Viewport({
  sceneKind: sceneKindProp,
  assetBaseUrl3D,
  assetBaseUrl2D,
  initialScene,
}: ViewportProps): React.JSX.Element {
  // Subscribe to the toolbar's toggle so clicking 2D/3D in the header
  // actually flips the viewport. Without this, the toolbar wrote to
  // viewportStore but nobody read from it — toggle was visually active
  // but a no-op functionally.
  const viewportMode = useViewportStore((s) => s.viewportMode);
  const setViewportMode = useViewportStore((s) => s.setViewportMode);

  // Seed viewportStore from `?kind=` ONCE on first mount. The toggle takes
  // over after that. Idempotent — re-running with same kind is a no-op.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const fromUrl = readKindFromUrl();
    if (fromUrl !== viewportMode) setViewportMode(fromUrl);
    // viewportMode read inside effect intentionally — we only seed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effective kind: explicit prop wins (programmatic override), otherwise
  // the live store value (toolbar-driven).
  const sceneKind = useMemo<SceneKind>(
    () => sceneKindProp ?? viewportMode,
    [sceneKindProp, viewportMode],
  );

  // Honor explicit props first; otherwise infer from the URL so the
  // ?engine=native flow can target any sample, not just harvest-rush.
  const resolvedBase3D = useMemo(
    () => assetBaseUrl3D ?? readSampleBaseUrlFromUrl(),
    [assetBaseUrl3D],
  );
  const resolvedBase2D = useMemo(
    () => assetBaseUrl2D ?? readSampleBaseUrlFromUrl(),
    [assetBaseUrl2D],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ThreeRuntimeMount
        visible={sceneKind === '3d'}
        assetBaseUrl={resolvedBase3D}
        initialScene={initialScene}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: sceneKind === '2d' ? 'block' : 'none',
        }}
      >
        <PhaserRuntimeMount visible={sceneKind === '2d'} assetBaseUrl={resolvedBase2D} />
      </div>
    </div>
  );
}

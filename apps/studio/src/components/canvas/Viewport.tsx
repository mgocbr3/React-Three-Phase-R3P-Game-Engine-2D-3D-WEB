// GDD §6.6 — Phase 6B step 5.
// The viewport. Picks Three vs Phaser based on the active scene kind.
// Both canvases live in the React tree simultaneously (D7) — `visible`
// toggles `display: block | none` so the WebGL context survives toggles.
//
// Phase 6B step 5: kind is now driven by either an explicit prop or the
// URL `?kind=2d|3d` query param. Phase 6B step 6 will move this to
// useEditorStore.activeSceneKind so the header 2D/3D buttons drive it.

import React, { useMemo } from 'react';

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
  const sceneKind = useMemo<SceneKind>(
    () => sceneKindProp ?? readKindFromUrl(),
    [sceneKindProp],
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

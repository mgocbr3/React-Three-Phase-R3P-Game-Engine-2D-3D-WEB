import { create } from 'zustand';

export type ViewportMode = '2d' | '3d';

interface ViewportState {
  /**
   * Effective viewport mode rendered by `<Viewport>`. Either set explicitly
   * by `setViewportMode` (boot-time URL seed) or by the project loader via
   * `setLockedKind` when a project is opened.
   */
  viewportMode: ViewportMode;

  /**
   * When non-null, the viewport mode is **locked** to the loaded project's
   * declared kind (2D Phaser project vs 3D Three.js project). The toolbar
   * 2D/3D toggle is hidden in this state — a project's kind is decided at
   * creation and never switched, so the runtime engines stay deterministic
   * and the editor avoids cross-engine state bugs.
   *
   * Set by project loaders (`applyProjectDocumentToEditor`, `openSampleProject`)
   * and cleared when returning to the Hub.
   */
  lockedKind: ViewportMode | null;

  setViewportMode: (mode: ViewportMode) => void;
  setLockedKind: (kind: ViewportMode | null) => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  viewportMode: '3d',
  lockedKind: null,
  setViewportMode: (mode) =>
    set((state) =>
      // Locked projects ignore manual toggle attempts. The store stays the
      // source-of-truth for the viewport, so we sync it back to the locked
      // kind if someone calls setViewportMode unexpectedly.
      state.lockedKind && mode !== state.lockedKind
        ? { viewportMode: state.lockedKind }
        : { viewportMode: mode },
    ),
  setLockedKind: (kind) =>
    set(() =>
      kind === null
        ? { lockedKind: null }
        : { lockedKind: kind, viewportMode: kind },
    ),
}));

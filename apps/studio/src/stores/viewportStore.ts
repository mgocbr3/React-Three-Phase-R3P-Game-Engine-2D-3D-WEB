import { create } from 'zustand';

export type ViewportMode = '2d' | '3d';

interface ViewportState {
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  viewportMode: '3d',
  setViewportMode: (mode) => set({ viewportMode: mode }),
}));

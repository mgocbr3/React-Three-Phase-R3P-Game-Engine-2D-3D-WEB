import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorPanelId = 'scene' | 'inspector' | 'bottom';
export type EditorLayoutPreset = 'default' | 'viewport-focus' | 'inspect';

type PanelVisibility = Record<EditorPanelId, boolean>;

interface EditorLayoutState {
  panels: PanelVisibility;
  preset: EditorLayoutPreset;
  setPanelVisible: (panel: EditorPanelId, visible: boolean) => void;
  togglePanel: (panel: EditorPanelId) => void;
  applyPreset: (preset: EditorLayoutPreset) => void;
  resetLayout: () => void;
}

const defaultPanels: PanelVisibility = {
  scene: true,
  inspector: true,
  bottom: true,
};

const presets: Record<EditorLayoutPreset, PanelVisibility> = {
  default: defaultPanels,
  'viewport-focus': {
    scene: false,
    inspector: false,
    bottom: false,
  },
  inspect: {
    scene: true,
    inspector: true,
    bottom: false,
  },
};

export const useEditorLayoutStore = create<EditorLayoutState>()(
  persist(
    (set) => ({
      panels: defaultPanels,
      preset: 'default',
      setPanelVisible: (panel, visible) =>
        set((state) => ({
          panels: { ...state.panels, [panel]: visible },
          preset: 'default',
        })),
      togglePanel: (panel) =>
        set((state) => ({
          panels: { ...state.panels, [panel]: !state.panels[panel] },
          preset: 'default',
        })),
      applyPreset: (preset) =>
        set(() => ({
          panels: presets[preset],
          preset,
        })),
      resetLayout: () =>
        set(() => ({
          panels: defaultPanels,
          preset: 'default',
        })),
    }),
    {
      name: 'pixlplayground-editor-layout',
    },
  ),
);

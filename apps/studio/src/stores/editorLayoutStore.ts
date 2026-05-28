import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorPanelId = 'scene' | 'viewport' | 'inspector' | 'bottom';
export type EditorLayoutPreset = 'default' | 'viewport-focus' | 'inspect';

type PanelVisibility = Record<EditorPanelId, boolean>;

interface EditorLayoutState {
  panels: PanelVisibility;
  dockOrder: EditorPanelId[];
  preset: EditorLayoutPreset;
  setPanelVisible: (panel: EditorPanelId, visible: boolean) => void;
  togglePanel: (panel: EditorPanelId) => void;
  movePanelBefore: (panel: EditorPanelId, target: EditorPanelId) => void;
  movePanelToEnd: (panel: EditorPanelId) => void;
  showAllPanels: () => void;
  applyPreset: (preset: EditorLayoutPreset) => void;
  resetLayout: () => void;
}

export const defaultDockOrder: EditorPanelId[] = ['scene', 'viewport', 'inspector', 'bottom'];

export const normalizeDockOrder = (order: EditorPanelId[] = []): EditorPanelId[] => {
  const seen = new Set<EditorPanelId>();
  const known = new Set(defaultDockOrder);
  return [
    ...order.filter((id) => known.has(id) && !seen.has(id) && seen.add(id)),
    ...defaultDockOrder.filter((id) => !seen.has(id)),
  ];
};

const defaultPanels: PanelVisibility = {
  scene: true,
  viewport: true,
  inspector: true,
  bottom: true,
};

const presets: Record<EditorLayoutPreset, PanelVisibility> = {
  default: defaultPanels,
  'viewport-focus': {
    scene: false,
    viewport: true,
    inspector: false,
    bottom: false,
  },
  inspect: {
    scene: true,
    viewport: true,
    inspector: true,
    bottom: false,
  },
};

export const useEditorLayoutStore = create<EditorLayoutState>()(
  persist(
    (set) => ({
      panels: defaultPanels,
      dockOrder: defaultDockOrder,
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
      movePanelBefore: (panel, target) =>
        set((state) => {
          if (panel === target) return state;
          const order = normalizeDockOrder(state.dockOrder).filter((id) => id !== panel);
          const index = order.indexOf(target);
          order.splice(index < 0 ? order.length : index, 0, panel);
          return { dockOrder: order, preset: 'default' };
        }),
      movePanelToEnd: (panel) =>
        set((state) => ({
          dockOrder: [...normalizeDockOrder(state.dockOrder).filter((id) => id !== panel), panel],
          preset: 'default',
        })),
      showAllPanels: () =>
        set((state) => ({
          panels: { ...defaultPanels },
          dockOrder: normalizeDockOrder(state.dockOrder),
          preset: 'default',
        })),
      applyPreset: (preset) =>
        set(() => ({
          panels: { ...presets[preset] },
          dockOrder: defaultDockOrder,
          preset,
        })),
      resetLayout: () =>
        set(() => ({
          panels: { ...defaultPanels },
          dockOrder: defaultDockOrder,
          preset: 'default',
        })),
    }),
    {
      name: 'pixlplayground-editor-layout',
      merge: (persisted, current) => {
        const saved = persisted as Partial<EditorLayoutState> | undefined;
        return {
          ...current,
          panels: { ...defaultPanels, ...saved?.panels },
          dockOrder: normalizeDockOrder(saved?.dockOrder),
          preset: saved?.preset ?? current.preset,
        };
      },
    },
  ),
);

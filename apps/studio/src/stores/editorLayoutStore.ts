import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorPanelId = 'scene' | 'viewport' | 'inspector' | 'bottom';
export type EditorLayoutPreset = 'default' | 'viewport-focus' | 'inspect';
export type EditorDockZone = 'main' | 'bottom';
export type EditorDockTarget = EditorPanelId | 'main-end' | 'bottom-end';

type PanelVisibility = Record<EditorPanelId, boolean>;
type PanelZones = Record<EditorPanelId, EditorDockZone>;

interface EditorLayoutState {
  panels: PanelVisibility;
  panelZones: PanelZones;
  dockOrder: EditorPanelId[];
  preset: EditorLayoutPreset;
  setPanelVisible: (panel: EditorPanelId, visible: boolean) => void;
  togglePanel: (panel: EditorPanelId) => void;
  movePanelBefore: (panel: EditorPanelId, target: EditorPanelId) => void;
  movePanelToEnd: (panel: EditorPanelId) => void;
  movePanelToZone: (panel: EditorPanelId, zone: EditorDockZone) => void;
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

const defaultPanelZones: PanelZones = {
  scene: 'main',
  viewport: 'main',
  inspector: 'main',
  bottom: 'bottom',
};

export const normalizePanelZones = (zones?: Partial<PanelZones>): PanelZones => ({
  ...defaultPanelZones,
  ...zones,
});

export const previewDockMove = (
  dockOrder: EditorPanelId[] = [],
  panelZones: Partial<PanelZones> | undefined,
  panel: EditorPanelId,
  target: EditorDockTarget | null,
): { dockOrder: EditorPanelId[]; panelZones: PanelZones } => {
  const zones = normalizePanelZones(panelZones);
  if (!target || target === panel) return { dockOrder: normalizeDockOrder(dockOrder), panelZones: zones };
  const order = normalizeDockOrder(dockOrder).filter((id) => id !== panel);
  const zone = target === 'bottom-end' ? 'bottom' : target === 'main-end' ? 'main' : zones[target];
  if (target === 'main-end' || target === 'bottom-end') order.push(panel);
  else order.splice(Math.max(order.indexOf(target), 0), 0, panel);
  return { dockOrder: order, panelZones: { ...zones, [panel]: zone } };
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
      panelZones: defaultPanelZones,
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
          return {
            ...previewDockMove(state.dockOrder, state.panelZones, panel, target),
            preset: 'default',
          };
        }),
      movePanelToEnd: (panel) =>
        set((state) => ({
          dockOrder: [...normalizeDockOrder(state.dockOrder).filter((id) => id !== panel), panel],
          preset: 'default',
        })),
      movePanelToZone: (panel, zone) =>
        set((state) => ({
          panels: { ...state.panels, [panel]: true },
          ...previewDockMove(state.dockOrder, state.panelZones, panel, zone === 'bottom' ? 'bottom-end' : 'main-end'),
          preset: 'default',
        })),
      showAllPanels: () =>
        set((state) => ({
          panels: { ...defaultPanels },
          panelZones: normalizePanelZones(state.panelZones),
          dockOrder: normalizeDockOrder(state.dockOrder),
          preset: 'default',
        })),
      applyPreset: (preset) =>
        set(() => ({
          panels: { ...presets[preset] },
          panelZones: { ...defaultPanelZones },
          dockOrder: defaultDockOrder,
          preset,
        })),
      resetLayout: () =>
        set(() => ({
          panels: { ...defaultPanels },
          panelZones: { ...defaultPanelZones },
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
          panelZones: normalizePanelZones(saved?.panelZones),
          dockOrder: normalizeDockOrder(saved?.dockOrder),
          preset: saved?.preset ?? current.preset,
        };
      },
    },
  ),
);

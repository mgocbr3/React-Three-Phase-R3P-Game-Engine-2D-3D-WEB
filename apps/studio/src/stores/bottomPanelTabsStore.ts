import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BottomTabId = 'assets' | 'ui' | 'timeline' | 'console';

export const defaultBottomTabOrder: BottomTabId[] = ['assets', 'ui', 'timeline', 'console'];

const knownTabs = new Set(defaultBottomTabOrder);

export const normalizeBottomTabOrder = (
  savedOrder: unknown,
  availableIds: readonly BottomTabId[] = defaultBottomTabOrder,
): BottomTabId[] => {
  const validIds = new Set(availableIds);
  const seen = new Set<BottomTabId>();
  const ordered = Array.isArray(savedOrder)
    ? savedOrder.filter((id): id is BottomTabId => {
      if (typeof id !== 'string' || !validIds.has(id as BottomTabId) || seen.has(id as BottomTabId)) return false;
      seen.add(id as BottomTabId);
      return true;
    })
    : [];
  return [...ordered, ...availableIds.filter((id) => !seen.has(id))];
};

export const normalizeClosedBottomTabs = (closedTabs: unknown): BottomTabId[] => (
  Array.isArray(closedTabs)
    ? closedTabs.filter((id, index, list): id is BottomTabId => typeof id === 'string' && knownTabs.has(id as BottomTabId) && list.indexOf(id) === index)
    : []
);

export const getVisibleBottomTabs = (order: BottomTabId[], closedTabs: BottomTabId[]) => (
  normalizeBottomTabOrder(order).filter((id) => !closedTabs.includes(id))
);

interface BottomPanelTabsState {
  activeTab: BottomTabId | null;
  tabOrder: BottomTabId[];
  closedTabs: BottomTabId[];
  setActiveTab: (tab: BottomTabId) => void;
  moveTabBefore: (source: BottomTabId, target: BottomTabId) => void;
  closeTab: (tab: BottomTabId) => void;
  restoreTab: (tab: BottomTabId) => void;
  restoreAllTabs: () => void;
  resetTabs: () => void;
}

export const useBottomPanelTabsStore = create<BottomPanelTabsState>()(
  persist(
    (set) => ({
      activeTab: 'assets',
      tabOrder: defaultBottomTabOrder,
      closedTabs: [],
      setActiveTab: (tab) => set((state) => (
        state.closedTabs.includes(tab) ? state : { activeTab: tab }
      )),
      moveTabBefore: (source, target) => set((state) => {
        if (source === target) return state;
        const next = normalizeBottomTabOrder(state.tabOrder).filter((id) => id !== source);
        next.splice(Math.max(next.indexOf(target), 0), 0, source);
        return { tabOrder: next };
      }),
      closeTab: (tab) => set((state) => {
        const closedTabs = normalizeClosedBottomTabs([...state.closedTabs, tab]);
        const visible = getVisibleBottomTabs(state.tabOrder, closedTabs);
        return { closedTabs, activeTab: state.activeTab === tab ? visible[0] ?? null : state.activeTab };
      }),
      restoreTab: (tab) => set((state) => ({
        closedTabs: state.closedTabs.filter((id) => id !== tab),
        tabOrder: normalizeBottomTabOrder(state.tabOrder),
        activeTab: tab,
      })),
      restoreAllTabs: () => set((state) => ({
        closedTabs: [],
        tabOrder: normalizeBottomTabOrder(state.tabOrder),
        activeTab: state.activeTab ?? getVisibleBottomTabs(state.tabOrder, [])[0] ?? 'assets',
      })),
      resetTabs: () => set(() => ({ activeTab: 'assets', tabOrder: defaultBottomTabOrder, closedTabs: [] })),
    }),
    {
      name: 'pixlplayground-bottom-tabs',
      merge: (persisted, current) => {
        const saved = persisted as Partial<BottomPanelTabsState> | undefined;
        const tabOrder = normalizeBottomTabOrder(saved?.tabOrder);
        const closedTabs = normalizeClosedBottomTabs(saved?.closedTabs);
        const visible = getVisibleBottomTabs(tabOrder, closedTabs);
        const activeTab = saved?.activeTab && visible.includes(saved.activeTab) ? saved.activeTab : visible[0] ?? null;
        return { ...current, tabOrder, closedTabs, activeTab };
      },
    },
  ),
);

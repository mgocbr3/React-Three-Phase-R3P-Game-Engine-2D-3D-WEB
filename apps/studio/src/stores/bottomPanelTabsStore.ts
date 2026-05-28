import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BottomTabId = 'assets' | 'ui' | 'timeline' | 'console';
export type BottomTabDropTarget = BottomTabId | 'end';

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

type BottomTabsLayoutSnapshot = {
  activeTab: BottomTabId | null;
  tabOrder: BottomTabId[];
  closedTabs: BottomTabId[];
};

const normalizeBottomTabsLayoutSnapshot = (
  snapshot?: Partial<BottomTabsLayoutSnapshot> | null,
): BottomTabsLayoutSnapshot | null => {
  if (!snapshot) return null;
  const tabOrder = normalizeBottomTabOrder(snapshot.tabOrder);
  const closedTabs = normalizeClosedBottomTabs(snapshot.closedTabs);
  const visible = getVisibleBottomTabs(tabOrder, closedTabs);
  const activeTab = snapshot.activeTab && visible.includes(snapshot.activeTab) ? snapshot.activeTab : visible[0] ?? null;
  return { activeTab, tabOrder, closedTabs };
};

export const previewBottomTabMove = (
  order: BottomTabId[],
  closedTabs: BottomTabId[],
  source: BottomTabId,
  target: BottomTabDropTarget,
): BottomTabId[] => {
  const next = getVisibleBottomTabs(order, closedTabs).filter((id) => id !== source);
  if (target === 'end') return [...next, source];
  next.splice(Math.max(next.indexOf(target), 0), 0, source);
  return next;
};

export const getBottomTabDropTarget = (
  visibleTabs: BottomTabId[],
  source: BottomTabId,
  over: BottomTabId,
  rect: { left: number; width: number },
  clientX: number,
): BottomTabDropTarget => {
  const x = Number.isFinite(clientX) ? clientX : rect.left;
  if (rect.width <= 0 || x <= rect.left + rect.width / 2) return over;
  const ordered = visibleTabs.filter((id) => id !== source);
  return ordered[ordered.indexOf(over) + 1] ?? 'end';
};

interface BottomPanelTabsState {
  activeTab: BottomTabId | null;
  tabOrder: BottomTabId[];
  closedTabs: BottomTabId[];
  savedTabsLayout: BottomTabsLayoutSnapshot | null;
  setActiveTab: (tab: BottomTabId) => void;
  moveTabBefore: (source: BottomTabId, target: BottomTabId) => void;
  moveTabToEnd: (source: BottomTabId) => void;
  closeTab: (tab: BottomTabId) => void;
  restoreTab: (tab: BottomTabId) => void;
  restoreAllTabs: () => void;
  saveCurrentTabsLayout: () => void;
  loadSavedTabsLayout: () => void;
  resetTabs: () => void;
}

export const useBottomPanelTabsStore = create<BottomPanelTabsState>()(
  persist(
    (set) => ({
      activeTab: 'assets',
      tabOrder: defaultBottomTabOrder,
      closedTabs: [],
      savedTabsLayout: null,
      setActiveTab: (tab) => set((state) => (
        state.closedTabs.includes(tab) ? state : { activeTab: tab }
      )),
      moveTabBefore: (source, target) => set((state) => {
        if (source === target) return state;
        const next = normalizeBottomTabOrder(state.tabOrder).filter((id) => id !== source);
        next.splice(Math.max(next.indexOf(target), 0), 0, source);
        return { tabOrder: next };
      }),
      moveTabToEnd: (source) => set((state) => ({
        tabOrder: [...normalizeBottomTabOrder(state.tabOrder).filter((id) => id !== source), source],
      })),
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
      saveCurrentTabsLayout: () => set((state) => ({
        savedTabsLayout: {
          activeTab: state.activeTab,
          tabOrder: normalizeBottomTabOrder(state.tabOrder),
          closedTabs: normalizeClosedBottomTabs(state.closedTabs),
        },
      })),
      loadSavedTabsLayout: () => set((state) => (
        normalizeBottomTabsLayoutSnapshot(state.savedTabsLayout) ?? state
      )),
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
        return {
          ...current,
          tabOrder,
          closedTabs,
          activeTab,
          savedTabsLayout: normalizeBottomTabsLayoutSnapshot(saved?.savedTabsLayout),
        };
      },
    },
  ),
);

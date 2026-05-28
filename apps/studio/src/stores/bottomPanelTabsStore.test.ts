import { beforeEach, describe, expect, it } from 'vitest';

import {
  defaultBottomTabOrder,
  getVisibleBottomTabs,
  normalizeBottomTabOrder,
  previewBottomTabMove,
  useBottomPanelTabsStore,
} from './bottomPanelTabsStore';

describe('bottomPanelTabsStore', () => {
  beforeEach(() => {
    useBottomPanelTabsStore.getState().resetTabs();
  });

  it('normalizes saved tab order against the local engine tab set', () => {
    expect(normalizeBottomTabOrder(['store', 'console', 'assets'])).toEqual([
      'console',
      'assets',
      'ui',
      'timeline',
    ]);
  });

  it('closes and restores bottom tabs from Window', () => {
    useBottomPanelTabsStore.getState().closeTab('assets');
    expect(getVisibleBottomTabs(useBottomPanelTabsStore.getState().tabOrder, useBottomPanelTabsStore.getState().closedTabs)).toEqual([
      'ui',
      'timeline',
      'console',
    ]);
    expect(useBottomPanelTabsStore.getState().activeTab).toBe('ui');

    useBottomPanelTabsStore.getState().restoreTab('assets');

    expect(useBottomPanelTabsStore.getState().closedTabs).toEqual([]);
    expect(useBottomPanelTabsStore.getState().activeTab).toBe('assets');
  });

  it('keeps default tabs recoverable after every bottom tab is closed', () => {
    defaultBottomTabOrder.forEach((tab) => useBottomPanelTabsStore.getState().closeTab(tab));
    expect(useBottomPanelTabsStore.getState().activeTab).toBeNull();

    useBottomPanelTabsStore.getState().restoreAllTabs();

    expect(useBottomPanelTabsStore.getState().closedTabs).toEqual([]);
    expect(useBottomPanelTabsStore.getState().activeTab).toBe('assets');
  });

  it('moves a dragged tab to the end of the visible tab strip', () => {
    useBottomPanelTabsStore.getState().moveTabToEnd('assets');

    expect(useBottomPanelTabsStore.getState().tabOrder).toEqual([
      'ui',
      'timeline',
      'console',
      'assets',
    ]);
  });

  it('previews a dragged tab position before the drop commits', () => {
    expect(previewBottomTabMove(defaultBottomTabOrder, [], 'assets', 'timeline')).toEqual([
      'ui',
      'assets',
      'timeline',
      'console',
    ]);
    expect(previewBottomTabMove(defaultBottomTabOrder, ['ui'], 'assets', 'end')).toEqual([
      'timeline',
      'console',
      'assets',
    ]);
  });

  it('saves and reloads bottom tab layout snapshots', () => {
    useBottomPanelTabsStore.getState().moveTabToEnd('assets');
    useBottomPanelTabsStore.getState().closeTab('ui');
    useBottomPanelTabsStore.getState().setActiveTab('console');
    useBottomPanelTabsStore.getState().saveCurrentTabsLayout();

    useBottomPanelTabsStore.getState().resetTabs();
    useBottomPanelTabsStore.getState().loadSavedTabsLayout();

    const state = useBottomPanelTabsStore.getState();
    expect(state.tabOrder).toEqual(['ui', 'timeline', 'console', 'assets']);
    expect(state.closedTabs).toEqual(['ui']);
    expect(state.activeTab).toBe('console');
  });
});

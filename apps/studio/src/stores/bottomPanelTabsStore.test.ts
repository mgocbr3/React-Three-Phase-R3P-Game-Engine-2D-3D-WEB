import { beforeEach, describe, expect, it } from 'vitest';

import {
  defaultBottomTabOrder,
  getVisibleBottomTabs,
  normalizeBottomTabOrder,
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
});

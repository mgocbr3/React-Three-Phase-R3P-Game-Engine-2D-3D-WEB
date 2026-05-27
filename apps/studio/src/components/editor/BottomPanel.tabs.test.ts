import { describe, expect, it } from 'vitest';

import { getAvailableBottomTabs, normalizeBottomTabOrder, shouldRenderStorePane } from './BottomPanel';

describe('BottomPanel tab availability', () => {
  it('hides Pixlland Store in local-only engine mode', () => {
    expect(getAvailableBottomTabs(false).map((tab) => tab.id)).toEqual([
      'assets',
      'ui',
      'timeline',
      'console',
    ]);
  });

  it('keeps Pixlland Store when cloud mode is enabled', () => {
    expect(getAvailableBottomTabs(true).map((tab) => tab.id)).toEqual([
      'assets',
      'ui',
      'timeline',
      'console',
      'store',
    ]);
  });

  it('normalizes saved tab order against the available tab set', () => {
    const availableTabs = getAvailableBottomTabs(false);

    expect(normalizeBottomTabOrder(['store', 'console', 'assets'], availableTabs)).toEqual([
      'console',
      'assets',
      'ui',
      'timeline',
    ]);
  });

  it('only mounts the cloud Store pane when the Store tab is active and cloud mode is enabled', () => {
    expect(shouldRenderStorePane('store', true)).toBe(true);
    expect(shouldRenderStorePane('store', false)).toBe(false);
    expect(shouldRenderStorePane('assets', true)).toBe(false);
  });
});

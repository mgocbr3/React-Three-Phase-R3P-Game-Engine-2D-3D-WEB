import { describe, expect, it } from 'vitest';

import { getAvailableBottomTabs, normalizeBottomTabOrder, shouldRenderStorePane } from './BottomPanel';

describe('BottomPanel tab availability', () => {
  it('keeps only local engine tabs in local mode', () => {
    expect(getAvailableBottomTabs(false).map((tab) => tab.id)).toEqual([
      'assets',
      'ui',
      'timeline',
      'console',
    ]);
  });

  it('does not expose Pixlland Store from the simplified engine build', () => {
    expect(getAvailableBottomTabs(true).map((tab) => tab.id)).toEqual([
      'assets',
      'ui',
      'timeline',
      'console',
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

  it('never mounts the cloud Store pane in the simplified engine build', () => {
    expect(shouldRenderStorePane('store', true)).toBe(false);
    expect(shouldRenderStorePane('store', false)).toBe(false);
    expect(shouldRenderStorePane('assets', true)).toBe(false);
  });
});

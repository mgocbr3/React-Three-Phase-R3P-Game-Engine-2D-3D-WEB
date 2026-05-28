import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useBottomPanelTabsStore } from '@/stores/bottomPanelTabsStore';
import { BottomPanel, getAvailableBottomTabs, normalizeBottomTabOrder, shouldRenderStorePane } from './BottomPanel';

describe('BottomPanel tab availability', () => {
  beforeEach(() => {
    useBottomPanelTabsStore.getState().resetTabs();
  });

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

  it('shows an end drop target while a bottom tab is dragged', () => {
    render(createElement(BottomPanel));

    expect(screen.queryByTestId('bottom-tab-end-drop')).not.toBeInTheDocument();

    const contentTab = screen.getByText('Content Browser').closest('[draggable="true"]');
    expect(contentTab).not.toBeNull();

    fireEvent.dragStart(contentTab!);

    expect(screen.getByTestId('bottom-tab-end-drop')).toBeVisible();
  });

  it('keeps the close control explicit and closes without starting a tab drag', () => {
    render(createElement(BottomPanel));

    const closeConsole = screen.getByTitle('Fechar Console');
    expect(closeConsole).toHaveAttribute('aria-label', 'Fechar Console');

    fireEvent.pointerDown(closeConsole);
    expect(screen.queryByTestId('bottom-tab-end-drop')).not.toBeInTheDocument();

    fireEvent.click(closeConsole);

    expect(useBottomPanelTabsStore.getState().closedTabs).toContain('console');
    expect(useBottomPanelTabsStore.getState().activeTab).toBe('assets');
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
  });

  it('previews bottom tab order while dragging over another tab', () => {
    render(createElement(BottomPanel));

    const tabNames = () => Array
      .from(document.querySelectorAll('[draggable="true"]'))
      .map((element) => element.textContent?.trim());
    const contentTab = screen.getByText('Content Browser').closest('[draggable="true"]');
    const timelineTab = screen.getByText('Timeline').closest('[draggable="true"]');
    expect(contentTab).not.toBeNull();
    expect(timelineTab).not.toBeNull();

    fireEvent.dragStart(contentTab!);
    fireEvent.dragOver(timelineTab!);

    expect(tabNames()).toEqual(['UI Editor', 'Content Browser', 'Timeline', 'Console']);
  });
});

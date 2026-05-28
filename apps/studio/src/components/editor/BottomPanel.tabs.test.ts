import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useBottomPanelTabsStore } from '@/stores/bottomPanelTabsStore';
import { useEditorStore } from '@/stores/editorStore';
import { BottomPanel, getAvailableBottomTabs, normalizeBottomTabOrder, shouldRenderStorePane } from './BottomPanel';

describe('BottomPanel tab availability', () => {
  beforeEach(() => {
    useBottomPanelTabsStore.getState().resetTabs();
    useEditorStore.setState({ activeSceneKind: '3d' });
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

    const contentTab = Array
      .from(document.querySelectorAll('[draggable="true"]'))
      .find((element) => element.textContent?.trim() === 'Project');
    expect(contentTab).not.toBeNull();

    fireEvent.dragStart(contentTab!);

    expect(screen.getByTestId('bottom-tab-end-drop')).toBeVisible();
  });

  it('keeps close under the ellipsis menu and closes without starting a tab drag', () => {
    render(createElement(BottomPanel));

    expect(screen.queryByTitle('Fechar Console')).toBeNull();

    const menuConsole = screen.getByTitle('Menu Console');
    fireEvent.pointerDown(menuConsole);
    expect(screen.queryByTestId('bottom-tab-end-drop')).not.toBeInTheDocument();

    fireEvent.click(menuConsole);
    fireEvent.click(screen.getByText('Close Tab'));

    expect(useBottomPanelTabsStore.getState().closedTabs).toContain('console');
    expect(useBottomPanelTabsStore.getState().activeTab).toBe('assets');
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
  });

  it('opens compact tab actions from the ellipsis menu', () => {
    render(createElement(BottomPanel));

    fireEvent.pointerDown(screen.getByTitle('Menu Project'));
    fireEvent.click(screen.getByTitle('Menu Project'));

    expect(screen.getByText('Move to End')).toBeVisible();
    expect(screen.getByText('Restore Tabs')).toBeVisible();
    expect(screen.getByText('Close Tab')).toBeVisible();
    expect(screen.queryByTestId('bottom-tab-end-drop')).not.toBeInTheDocument();
  });

  it('previews bottom tab order while dragging over another tab', () => {
    render(createElement(BottomPanel));

    const tabNames = () => Array
      .from(document.querySelectorAll('[draggable="true"]'))
      .map((element) => element.textContent?.trim());
    const contentTab = Array
      .from(document.querySelectorAll('[draggable="true"]'))
      .find((element) => element.textContent?.trim() === 'Project');
    const timelineTab = screen.getByText('Timeline').closest('[draggable="true"]');
    expect(contentTab).not.toBeNull();
    expect(timelineTab).not.toBeNull();

    fireEvent.dragStart(contentTab!);
    fireEvent.dragOver(timelineTab!);

    expect(tabNames()).toEqual(['UI Editor', 'Project', 'Timeline', 'Console']);
  });

  it('hides 3D model folders from the 2D content browser', () => {
    useEditorStore.setState({ activeSceneKind: '2d' });

    render(createElement(BottomPanel));

    expect(screen.getByText('Sprites')).toBeVisible();
    expect(screen.getByText('Tilemaps')).toBeVisible();
    expect(screen.queryByText('3D_Models')).not.toBeInTheDocument();
  });
});

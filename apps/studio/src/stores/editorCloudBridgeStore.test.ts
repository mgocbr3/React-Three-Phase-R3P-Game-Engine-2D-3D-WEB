import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getEditorCloudBridge, useEditorCloudBridgeStore } from './editorCloudBridgeStore';

describe('editorCloudBridgeStore', () => {
  beforeEach(() => {
    useEditorCloudBridgeStore.getState().resetBridge();
  });

  it('starts as a local-only no-op bridge', () => {
    const bridge = getEditorCloudBridge();

    expect(bridge.isReady).toBe(false);
    expect(bridge.isEmbedded).toBe(false);
    expect(bridge.currentProjectId).toBeNull();
    expect(bridge.saveToPixlland({ projectId: 'project-1' })).toBeUndefined();
    expect(bridge.requestProjects()).toBeUndefined();
  });

  it('can be configured by the legacy cloud integration and reset for local mode', () => {
    const saveToPixlland = vi.fn();
    const requestProjects = vi.fn();

    useEditorCloudBridgeStore.getState().configureBridge({
      isReady: true,
      isEmbedded: true,
      currentProjectId: 'project-1',
      saveToPixlland,
      requestProjects,
    });

    const configured = getEditorCloudBridge();
    configured.saveToPixlland({ projectId: 'project-1', title: 'Demo' });
    configured.requestProjects();

    expect(configured.isReady).toBe(true);
    expect(configured.isEmbedded).toBe(true);
    expect(configured.currentProjectId).toBe('project-1');
    expect(saveToPixlland).toHaveBeenCalledWith({ projectId: 'project-1', title: 'Demo' });
    expect(requestProjects).toHaveBeenCalled();

    configured.resetBridge();

    expect(getEditorCloudBridge().isReady).toBe(false);
    expect(getEditorCloudBridge().currentProjectId).toBeNull();
  });
});

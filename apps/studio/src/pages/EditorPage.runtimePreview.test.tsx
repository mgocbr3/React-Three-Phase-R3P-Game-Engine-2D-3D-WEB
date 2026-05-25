import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import EditorPage from './EditorPage';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import type { RuntimePreviewSession } from '@/engine/runtime/runtimePreview';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/components/canvas/EditorCanvas', () => ({
  EditorCanvas: () => <div data-testid="editor-canvas" />,
}));

vi.mock('@/components/canvas/Viewport', () => ({
  Viewport: () => <div data-testid="native-viewport" />,
}));

vi.mock('@/components/editor/EditorHeader', () => ({
  EditorHeader: () => <div data-testid="editor-header" />,
}));

vi.mock('@/components/editor/EditorStatusBar', () => ({
  EditorStatusBar: () => <div data-testid="editor-status" />,
}));

vi.mock('@/components/editor/SceneGraphPanel', () => ({
  SceneGraphPanel: () => <div data-testid="scene-graph" />,
}));

vi.mock('@/components/editor/InspectorPanel', () => ({
  InspectorPanel: () => <div data-testid="inspector" />,
}));

vi.mock('@/components/editor/BottomPanel', () => ({
  BottomPanel: () => <div data-testid="bottom-panel" />,
}));

vi.mock('@/components/editor/CameraSpeedIndicator', () => ({
  CameraSpeedIndicator: () => <div data-testid="camera-speed" />,
}));

vi.mock('@/components/canvas/MotionControlOverlay', () => ({
  MotionControlOverlay: () => <div data-testid="motion-overlay" />,
}));

vi.mock('@/components/editor/ConflictResolutionDialog', () => ({
  ConflictResolutionDialog: () => <div data-testid="conflict-dialog" />,
}));

vi.mock('@/components/editor/RuntimeGameFrame', () => ({
  RuntimeGameFrame: () => <div data-testid="runtime-game-frame" />,
}));

vi.mock('@/components/editor/RuntimePreviewOverlay', () => ({
  RuntimePreviewOverlay: () => <div data-testid="runtime-preview-overlay" />,
}));

vi.mock('@/legacy/cloud/hooks/useProjectAutoSave', () => ({
  useProjectAutoSave: () => ({
    setCloudProjectId: vi.fn(),
    pendingConflict: null,
    isResolvingConflict: false,
    resolveConflict: vi.fn(),
  }),
}));

vi.mock('@/hooks/useEditorAutosave', () => ({
  useEditorAutosave: () => undefined,
}));

vi.mock('@/hooks/useEditorArrowNudge', () => ({
  useEditorArrowNudge: () => undefined,
}));

vi.mock('@/hooks/usePixllandBridge', () => ({
  usePixllandBridge: () => ({
    openProject: vi.fn(),
    saveToPixlland: vi.fn(),
    requestProjects: vi.fn(),
  }),
}));

vi.mock('@/services/sampleProjects', () => ({
  hasSampleProject: () => false,
  openSampleProject: vi.fn(),
}));

vi.mock('@/services/localProjectFiles', () => ({
  hasActiveProjectWorkspace: () => false,
  openStoredProjectWorkspace: vi.fn(),
  saveActiveProjectDocumentToDirectory: vi.fn(),
}));

vi.mock('@/services/filePickerLock', () => ({
  FilePickerBusyError: class FilePickerBusyError extends Error {},
}));

const makePreviewSession = (): RuntimePreviewSession => ({
  id: 'runtime-test',
  projectId: 'project-test',
  projectName: 'Sample 3D Runtime',
  runtime: 'three-3d',
  sceneId: 'sample-main',
  sceneKind: '3d',
  source: 'editor',
  startedAt: 1,
  document: {} as RuntimePreviewSession['document'],
  launchTarget: {
    kind: 'web-runtime',
    gameSlug: 'sample-3d-runtime',
    runtimeFile: 'runtime/src/main.js',
    scriptUrl: '/sample-projects/sample-3d-runtime/runtime/src/main.js',
    documentBaseUrl: '/sample-projects/sample-3d-runtime/',
    sdkUrl: null,
  },
});

describe('EditorPage runtime preview', () => {
  beforeEach(() => {
    useRuntimeGameStore.setState({
      previewSession: null,
      previewDisplayMode: 'inframe',
      isPlaying: false,
    });
    window.history.replaceState({}, '', '/editor?engine=native');
  });

  it('mounts the real runtime frame during desktop play preview', () => {
    useRuntimeGameStore.setState({
      previewSession: makePreviewSession(),
      previewDisplayMode: 'inframe',
      isPlaying: true,
    });

    render(
      <MemoryRouter initialEntries={['/editor?engine=native']}>
        <EditorPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('runtime-game-frame')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-preview-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('native-viewport')).not.toBeInTheDocument();
  });
});

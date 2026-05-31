import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore, type SceneObject } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { EditorStatusBar } from './EditorStatusBar';
import type { RuntimePreviewSession } from '@/engine/runtime/runtimePreview';

const previewSession: RuntimePreviewSession = {
  id: 'runtime-test',
  projectId: 'project-test',
  projectName: 'Runtime Test',
  runtime: 'phaser-2d',
  launchTarget: { kind: 'scene-preview' },
  sceneId: 'main',
  sceneKind: '2d',
  source: 'editor',
  startedAt: 1,
  document: {} as RuntimePreviewSession['document'],
};

const object = (type: SceneObject['type'], id = type): SceneObject => ({
  id,
  name: id,
  type,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#ffffff',
  visible: true,
  locked: false,
});

describe('EditorStatusBar scene metrics', () => {
  beforeEach(() => {
    useRuntimeGameStore.getState().stopPreview();
    useEngineSettings.setState({ showStats: false });
    useEditorStore.setState({ activeSceneKind: '3d', objects: [] });
  });

  it('uses 2D metrics in Phaser scenes', () => {
    useEditorStore.setState({
      activeSceneKind: '2d',
      objects: [object('sprite'), object('rectangle'), object('text')],
    });

    render(<EditorStatusBar />);

    const status = screen.getByRole('contentinfo');
    expect(within(status).getByText('objects')).toBeVisible();
    expect(within(status).getByText('2D items')).toBeVisible();
    expect(within(status).queryByText('meshes')).not.toBeInTheDocument();
    expect(within(status).queryByText('tris')).not.toBeInTheDocument();
  });

  it('keeps mesh and triangle metrics in Three.js scenes', () => {
    useEditorStore.setState({
      activeSceneKind: '3d',
      objects: [object('box'), object('sphere')],
    });

    render(<EditorStatusBar />);

    const status = screen.getByRole('contentinfo');
    expect(within(status).getByText('meshes')).toBeVisible();
    expect(within(status).getByText('tris')).toBeVisible();
  });

  it('keeps the status bar mounted while Play Mode is active', () => {
    useRuntimeGameStore.setState({ previewSession, isPlaying: true });

    render(<EditorStatusBar />);

    const status = screen.getByRole('contentinfo');
    expect(within(status).getByText('Play Mode · Phaser 2D')).toBeVisible();
  });
});

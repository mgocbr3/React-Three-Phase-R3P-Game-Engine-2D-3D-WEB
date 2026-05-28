import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore, type SceneObject } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { InspectorPanel } from './InspectorPanel';

const sprite: SceneObject = {
  id: 'hero',
  name: 'Hero',
  type: 'sprite',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#ffffff',
  visible: true,
  locked: false,
};

describe('InspectorPanel object icons', () => {
  beforeEach(() => {
    useRuntimeGameStore.getState().stopPreview();
    useEditorStore.setState({
      activeSceneKind: '2d',
      isEditMode: true,
      objects: [sprite],
      selectedObjectId: 'hero',
    });
  });

  it('uses a 2D visual icon for sprite objects', () => {
    const { container } = render(<InspectorPanel />);

    expect(screen.getByDisplayValue('Hero')).toBeVisible();
    expect(container.querySelector('.glass-object-header .lucide-image')).not.toBeNull();
    expect(container.querySelector('.glass-object-header .lucide-box')).toBeNull();
  });

  it('locks inspector editing controls while Play Mode is active', () => {
    useEditorStore.setState({ isEditMode: false });

    render(<InspectorPanel />);

    expect(screen.getByDisplayValue('Hero')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Scripts' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vibe Code' })).toBeDisabled();
  });
});

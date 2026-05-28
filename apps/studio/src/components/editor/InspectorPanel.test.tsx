import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorStore, type SceneObject } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { DockFrame } from './DockFrame';
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

  it('keeps inspector tabs compact while preserving full labels for tools', () => {
    const { container } = render(<InspectorPanel />);

    const vibeTab = screen.getByRole('button', { name: 'Vibe Code' });

    expect(container.querySelector('.editor-dock-outline')).toBeNull();
    expect(container.querySelectorAll('.panel-header')).toHaveLength(1);
    expect(vibeTab).toHaveAttribute('title', 'Vibe Code');
    expect(vibeTab).toHaveTextContent('Vibe');
    expect(vibeTab).not.toHaveTextContent('Vibe Code');
    expect(vibeTab.querySelector('span')).toHaveClass('whitespace-nowrap');
  });

  it('lets the unified inspector tab strip start a dock drag', () => {
    const onPointerDown = vi.fn();

    render(
      <DockFrame
        id="inspector"
        zone="main"
        label="Inspector"
        onClose={vi.fn()}
        onDockMain={vi.fn()}
        onDockBottom={vi.fn()}
        onResetDock={vi.fn()}
        dragging={false}
        draggingAny={false}
        dropActive={false}
        onPointerDown={onPointerDown}
        customChrome
      >
        <InspectorPanel />
      </DockFrame>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Inspector' }));

    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });
});

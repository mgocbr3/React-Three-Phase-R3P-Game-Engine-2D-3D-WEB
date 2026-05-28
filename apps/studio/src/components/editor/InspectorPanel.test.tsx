import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEditorStore, type SceneObject } from '@/stores/editorStore';
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
    useEditorStore.setState({
      activeSceneKind: '2d',
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
});

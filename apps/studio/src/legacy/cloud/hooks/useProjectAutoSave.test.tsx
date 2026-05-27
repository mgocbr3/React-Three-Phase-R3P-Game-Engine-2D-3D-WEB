import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorStore, type SceneObject } from '@/stores/editorStore';
import { useProjectAutoSave } from './useProjectAutoSave';

const makeObject = (id: string): SceneObject => ({
  id,
  name: id,
  type: 'group',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#ffffff',
  visible: true,
  locked: false,
});

const Harness = () => {
  useProjectAutoSave();
  return null;
};

describe('useProjectAutoSave local-only mode', () => {
  const saveProject = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    saveProject.mockReset();
    useEditorStore.setState({
      objects: [makeObject('root')],
      currentTemplateId: null,
      gameScript: '// test',
      saveProject,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not start the legacy autosave interval when cloud mode is disabled', () => {
    render(<Harness />);

    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(saveProject).not.toHaveBeenCalled();
  });

  it('does not install the legacy Ctrl+S handler when cloud mode is disabled', () => {
    render(<Harness />);

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    expect(saveProject).not.toHaveBeenCalled();
  });
});

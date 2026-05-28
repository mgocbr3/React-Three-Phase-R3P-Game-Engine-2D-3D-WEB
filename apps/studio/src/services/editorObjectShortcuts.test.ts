import { describe, expect, it, vi } from 'vitest';

import { handleEditorObjectShortcut, type EditorObjectShortcutEvent } from './editorObjectShortcuts';

const makeEvent = (overrides: Partial<EditorObjectShortcutEvent> = {}): EditorObjectShortcutEvent => ({
  key: 'c',
  ctrlKey: true,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: document.createElement('div'),
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  ...overrides,
});

const makeActions = () => ({
  selectedObjectId: 'hero',
  copyObject: vi.fn(() => true),
  cutObject: vi.fn(() => true),
  pasteObject: vi.fn(() => 'hero-copy'),
  duplicateObject: vi.fn(),
  deleteObject: vi.fn(),
  hasObjectClipboard: vi.fn(() => true),
});

describe('editor object shortcuts', () => {
  it('routes Unity-style object clipboard shortcuts to editor actions', () => {
    const actions = makeActions();

    expect(handleEditorObjectShortcut(makeEvent({ key: 'c' }), actions)).toBe(true);
    expect(actions.copyObject).toHaveBeenCalledWith('hero');

    expect(handleEditorObjectShortcut(makeEvent({ key: 'x' }), actions)).toBe(true);
    expect(actions.cutObject).toHaveBeenCalledWith('hero');

    expect(handleEditorObjectShortcut(makeEvent({ key: 'v' }), actions)).toBe(true);
    expect(actions.pasteObject).toHaveBeenCalled();

    expect(handleEditorObjectShortcut(makeEvent({ key: 'd' }), actions)).toBe(true);
    expect(actions.duplicateObject).toHaveBeenCalledWith('hero');
  });

  it('routes Delete and Backspace to selected-object deletion', () => {
    const actions = makeActions();

    expect(handleEditorObjectShortcut(makeEvent({ key: 'Delete', ctrlKey: false }), actions)).toBe(true);
    expect(handleEditorObjectShortcut(makeEvent({ key: 'Backspace', ctrlKey: false }), actions)).toBe(true);

    expect(actions.deleteObject).toHaveBeenCalledTimes(2);
    expect(actions.deleteObject).toHaveBeenCalledWith('hero');
  });

  it('does not steal editor shortcuts from typing fields or missing selections', () => {
    const input = document.createElement('input');
    const actions = makeActions();

    expect(handleEditorObjectShortcut(makeEvent({ key: 'c', target: input }), actions)).toBe(false);
    expect(handleEditorObjectShortcut(makeEvent({ key: 'c' }), {
      ...actions,
      selectedObjectId: null,
    })).toBe(false);

    expect(actions.copyObject).not.toHaveBeenCalled();
  });

  it('does not paste when the object clipboard is empty', () => {
    const actions = {
      ...makeActions(),
      hasObjectClipboard: vi.fn(() => false),
    };

    expect(handleEditorObjectShortcut(makeEvent({ key: 'v' }), actions)).toBe(false);
    expect(actions.pasteObject).not.toHaveBeenCalled();
  });
});

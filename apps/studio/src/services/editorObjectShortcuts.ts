export interface EditorObjectShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export interface EditorObjectShortcutActions {
  selectedObjectId: string | null;
  copyObject: (id: string) => boolean;
  cutObject: (id: string) => boolean;
  pasteObject: () => string | null;
  duplicateObject: (id: string) => void;
  deleteObject: (id: string) => void;
  hasObjectClipboard: () => boolean;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const claimEvent = (event: EditorObjectShortcutEvent): void => {
  event.preventDefault();
  event.stopPropagation();
};

export const handleEditorObjectShortcut = (
  event: EditorObjectShortcutEvent,
  actions: EditorObjectShortcutActions,
): boolean => {
  if (isTypingTarget(event.target)) return false;

  const key = event.key.toLowerCase();
  const mod = event.ctrlKey || event.metaKey;
  const selectedObjectId = actions.selectedObjectId;

  if (mod) {
    if (key === 'v') {
      if (!actions.hasObjectClipboard()) return false;
      claimEvent(event);
      actions.pasteObject();
      return true;
    }

    if (!selectedObjectId) return false;

    if (key === 'c') {
      claimEvent(event);
      return actions.copyObject(selectedObjectId);
    }
    if (key === 'x') {
      claimEvent(event);
      return actions.cutObject(selectedObjectId);
    }
    if (key === 'd') {
      claimEvent(event);
      actions.duplicateObject(selectedObjectId);
      return true;
    }

    return false;
  }

  if ((key === 'delete' || key === 'backspace') && selectedObjectId) {
    claimEvent(event);
    actions.deleteObject(selectedObjectId);
    return true;
  }

  return false;
};

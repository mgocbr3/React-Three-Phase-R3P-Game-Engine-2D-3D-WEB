import type { EditorPanelId } from '@/stores/editorLayoutStore';

const weight = (id: EditorPanelId) => (id === 'viewport' ? 46 : 18);

export const getDockPanelSize = (id: EditorPanelId, visibleIds: EditorPanelId[]) => {
  const total = visibleIds.reduce((sum, panel) => sum + weight(panel), 0) || weight(id);
  const only = visibleIds.length <= 1;
  return {
    defaultSize: only ? 100 : (weight(id) / total) * 100,
    minSize: only ? 100 : id === 'viewport' ? 30 : 12,
    maxSize: only ? 100 : id === 'viewport' ? 80 : 45,
  };
};

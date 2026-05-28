import type { EditorDockTarget, EditorDockZone, EditorPanelId } from '@/stores/editorLayoutStore';

export type DockPanelRect = {
  id: EditorPanelId;
  zone: EditorDockZone;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DockDragGhostPositionInput = {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  width?: number;
  height?: number;
  target?: EditorDockTarget | null;
  panels?: readonly DockPanelRect[];
};

const weight = (id: EditorPanelId) => (id === 'viewport' ? 46 : 18);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getDockPanelSize = (id: EditorPanelId, visibleIds: EditorPanelId[]) => {
  const total = visibleIds.reduce((sum, panel) => sum + weight(panel), 0) || weight(id);
  const only = visibleIds.length <= 1;
  return {
    defaultSize: only ? 100 : (weight(id) / total) * 100,
    minSize: only ? 100 : id === 'viewport' ? 30 : 12,
    maxSize: only ? 100 : id === 'viewport' ? 80 : 45,
  };
};

export const resolveDockTargetFromRects = ({
  x,
  y,
  viewportHeight,
  panels,
}: {
  x: number;
  y: number;
  viewportHeight: number;
  panels: readonly DockPanelRect[];
}): EditorDockTarget | null => {
  if (y > viewportHeight - Math.max(170, viewportHeight * 0.34)) return 'bottom-end';
  const hit = panels.find((p) => x >= p.left && x <= p.left + p.width && y >= p.top && y <= p.top + p.height);
  if (!hit) return null;
  if (x < hit.left + hit.width / 2) return hit.id;
  const row = panels.filter((p) => p.zone === hit.zone && y >= p.top && y <= p.top + p.height).sort((a, b) => a.left - b.left);
  return row.find((p) => p.left > hit.left)?.id ?? (hit.zone === 'bottom' ? 'bottom-end' : 'main-end');
};

export const getDockDragGhostPosition = ({
  x,
  y,
  viewportWidth,
  viewportHeight,
  width = 224,
  height = 76,
  target = null,
  panels = [],
}: DockDragGhostPositionInput) => {
  const margin = 12;
  const offset = 14;
  const snap = target && target !== 'main-end' && target !== 'bottom-end'
    ? panels.find((panel) => panel.id === target)
    : null;
  if (snap) {
    return {
      left: clamp(snap.left + margin, margin, Math.max(margin, viewportWidth - width - margin)),
      top: clamp(snap.top + margin, margin, Math.max(margin, viewportHeight - height - margin)),
    };
  }
  if (target === 'bottom-end') {
    const bottomTop = viewportHeight - Math.max(170, viewportHeight * 0.34);
    return {
      left: clamp(viewportWidth / 2 - width / 2, margin, Math.max(margin, viewportWidth - width - margin)),
      top: clamp(bottomTop + margin, margin, Math.max(margin, viewportHeight - height - margin)),
    };
  }
  if (target === 'main-end') {
    const row = panels.filter((panel) => panel.zone === 'main');
    const right = row.reduce((max, panel) => Math.max(max, panel.left + panel.width), x);
    const top = row.reduce((min, panel) => Math.min(min, panel.top), y);
    return {
      left: clamp(right - width + margin, margin, Math.max(margin, viewportWidth - width - margin)),
      top: clamp(top + margin, margin, Math.max(margin, viewportHeight - height - margin)),
    };
  }
  return {
    left: clamp(x + offset, margin, Math.max(margin, viewportWidth - width - margin)),
    top: clamp(y + offset, margin, Math.max(margin, viewportHeight - height - margin)),
  };
};

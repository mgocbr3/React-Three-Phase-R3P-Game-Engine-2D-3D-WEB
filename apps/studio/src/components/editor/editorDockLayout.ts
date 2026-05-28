import type { EditorDockTarget, EditorDockZone, EditorPanelId } from '@/stores/editorLayoutStore';
import type { SceneKind } from '@/stores/editorStore';

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

export type DockDropPreviewRectInput = {
  target: EditorDockTarget | null;
  panels: readonly DockPanelRect[];
  viewportWidth: number;
  viewportHeight: number;
};

const weight = (id: EditorPanelId) => (id === 'viewport' ? 46 : 18);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getDockPanelLabels = (sceneKind: SceneKind): Record<EditorPanelId, string> => ({
  scene: 'Hierarchy',
  viewport: sceneKind === '2d' ? 'Preview 2D' : 'Scene 3D',
  inspector: 'Inspector',
  bottom: 'Project',
});

export const getDockPanelSize = (id: EditorPanelId, visibleIds: EditorPanelId[]) => {
  const total = visibleIds.reduce((sum, panel) => sum + weight(panel), 0) || weight(id);
  const only = visibleIds.length <= 1;
  const defaultSize = only ? 100 : (weight(id) / total) * 100;
  const minSize = only ? 100 : id === 'viewport' ? 30 : 12;
  const maxSize = only ? 100 : id === 'viewport' ? 80 : 45;
  return {
    defaultSize,
    minSize: Math.min(minSize, defaultSize),
    maxSize: Math.max(maxSize, defaultSize),
  };
};

export const getDockZoneLayout = (mainIds: EditorPanelId[], bottomIds: EditorPanelId[]) => {
  const showMain = mainIds.length > 0;
  const showBottom = bottomIds.length > 0;
  return {
    showMain,
    showBottom,
    mainDefaultSize: showMain ? (showBottom ? 72 : 100) : 0,
    bottomDefaultSize: showBottom ? (showMain ? 28 : 100) : 0,
  };
};

export const getDockRowKey = (zone: EditorDockZone, ids: readonly EditorPanelId[]) => (
  `${zone}:${ids.join('|') || 'empty'}`
);

export const resolveDockTargetFromRects = ({
  x,
  y,
  viewportHeight,
  panels,
  source = null,
}: {
  x: number;
  y: number;
  viewportHeight: number;
  panels: readonly DockPanelRect[];
  source?: EditorPanelId | null;
}): EditorDockTarget | null => {
  const candidates = source ? panels.filter((panel) => panel.id !== source) : panels;
  const hit = candidates.find((p) => x >= p.left && x <= p.left + p.width && y >= p.top && y <= p.top + p.height);
  const inBottomMagnet = y > viewportHeight - Math.max(170, viewportHeight * 0.34);
  if (inBottomMagnet && hit?.zone !== 'bottom') return 'bottom-end';
  if (hit) {
    if (x < hit.left + hit.width / 2) return hit.id;
    const row = candidates.filter((p) => p.zone === hit.zone && y >= p.top && y <= p.top + p.height).sort((a, b) => a.left - b.left);
    return row.find((p) => p.left > hit.left)?.id ?? (hit.zone === 'bottom' ? 'bottom-end' : 'main-end');
  }
  return inBottomMagnet ? 'bottom-end' : null;
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

export const getDockDropPreviewRect = ({
  target,
  panels,
  viewportWidth,
  viewportHeight,
}: DockDropPreviewRectInput) => {
  if (!target) return null;
  const slot = 6;
  const margin = 12;
  if (target === 'bottom-end') {
    const row = panels.filter((panel) => panel.zone === 'bottom');
    if (row.length) {
      const top = Math.min(...row.map((panel) => panel.top));
      const bottom = Math.max(...row.map((panel) => panel.top + panel.height));
      return { left: Math.max(...row.map((panel) => panel.left + panel.width)) - slot, top, width: slot, height: bottom - top };
    }
    const top = viewportHeight - Math.max(170, viewportHeight * 0.34);
    return { left: margin, top, width: Math.max(slot, viewportWidth - margin * 2), height: viewportHeight - top - margin };
  }
  const zone = target === 'main-end' ? 'main' : panels.find((panel) => panel.id === target)?.zone;
  const row = panels.filter((panel) => panel.zone === zone).sort((a, b) => a.left - b.left);
  if (!row.length) return null;
  const top = Math.min(...row.map((panel) => panel.top));
  const bottom = Math.max(...row.map((panel) => panel.top + panel.height));
  const left = target === 'main-end'
    ? Math.max(...row.map((panel) => panel.left + panel.width)) - slot
    : (panels.find((panel) => panel.id === target)?.left ?? row[0].left) - slot / 2;
  return { left: clamp(left, 0, viewportWidth - slot), top, width: slot, height: bottom - top };
};

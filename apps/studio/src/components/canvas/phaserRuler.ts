export const getRulerMarks = (halfSize: number, step: number): number[] => {
  const marks: number[] = [];
  for (let value = -halfSize; value <= halfSize; value += step) marks.push(value);
  return marks;
};

export const formatRulerMark = (value: number): string => String(value);

export interface ViewportRulerTick {
  screen: number;
  world: number;
  labeled: boolean;
}

export interface ViewportGridLine {
  screen: number;
  world: number;
  major: boolean;
}

export interface ViewportWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getViewportRulerTicks = (
  scroll: number,
  viewportSize: number,
  zoom: number,
  step: number,
  labelEvery: number,
): ViewportRulerTick[] => {
  const ticks: ViewportRulerTick[] = [];
  const stepPx = step * zoom;
  if (stepPx <= 4) return ticks;
  const firstWorld = Math.floor(scroll / step) * step;
  for (let world = firstWorld; (world - scroll) * zoom < viewportSize + stepPx; world += step) {
    ticks.push({
      screen: Math.round((world - scroll) * zoom),
      world,
      labeled: world % (step * labelEvery) === 0,
    });
  }
  return ticks;
};

export const getViewportGridLines = (
  scroll: number,
  viewportSize: number,
  zoom: number,
  step: number,
  majorEvery: number,
): ViewportGridLine[] => {
  const lines: ViewportGridLine[] = [];
  const stepPx = step * zoom;
  if (stepPx <= 3) return lines;
  const firstWorld = Math.floor(scroll / step) * step;
  for (let world = firstWorld; (world - scroll) * zoom < viewportSize + stepPx; world += step) {
    lines.push({
      screen: Math.round((world - scroll) * zoom),
      world,
      major: world % (step * majorEvery) === 0,
    });
  }
  return lines;
};

export const getEditorZoom = (current: number, deltaY: number): number => {
  if (deltaY === 0) return current;
  const next = current * (deltaY < 0 ? 1.1 : 0.9);
  return Math.min(4, Math.max(0.25, Number(next.toFixed(2))));
};

export const getZoomedScroll = (
  scroll: number,
  pointerScreen: number,
  currentZoom: number,
  nextZoom: number,
): number => scroll + pointerScreen / currentZoom - pointerScreen / nextZoom;

export const getFittedViewportCamera = (
  bounds: ViewportWorldBounds,
  viewport: { width: number; height: number },
  padding = 96,
): { scrollX: number; scrollY: number; zoom: number } => {
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const viewW = Math.max(1, viewport.width);
  const viewH = Math.max(1, viewport.height);
  const zoom = Number(Math.min(4, Math.max(0.25, Math.min(
    Math.max(1, viewW - padding * 2) / contentW,
    Math.max(1, viewH - padding * 2) / contentH,
  ))).toFixed(2));
  const cx = bounds.minX + contentW / 2;
  const cy = bounds.minY + contentH / 2;
  return {
    scrollX: Number((cx - viewW / (zoom * 2)).toFixed(2)),
    scrollY: Number((cy - viewH / (zoom * 2)).toFixed(2)),
    zoom,
  };
};

export const formatPointerPosition = (x: number, y: number): string => (
  `X ${Math.round(x)}  Y ${Math.round(y)}`
);
